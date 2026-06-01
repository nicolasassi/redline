import { ItemView, WorkspaceLeaf, MarkdownView, MarkdownRenderer, TFile, Notice } from "obsidian";
import { CommentStore } from "../comment-store";
import { ReviewComment } from "../sidecar";
import { AddCommentModal } from "./add-comment-modal";

export const REVIEW_VIEW_TYPE = "obsidian-review-sidebar";

type Filter = "all" | "open" | "resolved" | "stale";

export class ReviewSidebar extends ItemView {
  private filter: Filter = "open";
  private currentDocPath: string | null = null;
  private renderGen = 0;

  constructor(leaf: WorkspaceLeaf, private store: CommentStore) {
    super(leaf);
  }

  getViewType() {
    return REVIEW_VIEW_TYPE;
  }
  getDisplayText() {
    return "Redline";
  }
  getIcon() {
    return "messages-square";
  }

  async onOpen() {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refresh())
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!this.currentDocPath) return;
        const sidecarPath = this.currentDocPath + ".review.md";
        if (file.path !== this.currentDocPath && file.path !== sidecarPath) return;
        this.refresh();
      })
    );
    await this.refresh();
  }

  async refresh() {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    const path = active?.file?.path;
    if (path && !path.endsWith(".review.md")) {
      this.currentDocPath = path;
    }
    this.render();
  }

  private async render() {
    const gen = ++this.renderGen;
    const root = this.contentEl;

    if (!this.currentDocPath || this.currentDocPath.endsWith(".review.md")) {
      if (gen !== this.renderGen) return;
      root.empty();
      root.createEl("p", { text: "No reviewable document is active." });
      return;
    }

    const sidecar = await this.store.readSidecar(this.currentDocPath);
    if (gen !== this.renderGen) return;
    root.empty();
    const all = (sidecar?.comments ?? []).filter((c) => c.status !== "archived");
    const counts = {
      open: all.filter((c) => c.status === "open").length,
      resolved: all.filter((c) => c.status === "resolved").length,
      stale: all.filter((c) => c.status === "stale").length,
    };

    const header = root.createDiv({ cls: "review-header" });
    header.createEl("h4", {
      text: `Redline · ${counts.open} open · ${counts.resolved} resolved · ${counts.stale} stale`,
    });

    const filterBar = root.createDiv({ cls: "review-filters" });
    for (const f of ["all", "open", "resolved", "stale"] as Filter[]) {
      const btn = filterBar.createEl("button", { text: f });
      if (f === this.filter) btn.addClass("active");
      btn.onclick = () => {
        this.filter = f;
        this.render();
      };
    }

    const visible = all.filter((c) => this.filter === "all" || c.status === this.filter);
    for (const c of visible) {
      this.renderCommentCard(root, c);
    }
  }

  private renderCommentCard(parent: HTMLElement, c: ReviewComment) {
    const card = parent.createDiv({ cls: `review-card review-card-${c.status}` });
    const header = card.createDiv({ cls: "review-card-header" });
    header.createEl("span", { text: `${c.id} · ${c.status}`, cls: "review-card-id" });
    header.createEl("span", { text: c.target, cls: "review-card-target" });

    const body = card.createDiv({ cls: "review-card-body" });
    const sourcePath = this.currentDocPath ?? "";
    void MarkdownRenderer.render(this.app, c.body || "*(no body)*", body, sourcePath, this);

    if (c.resolution) {
      card.createEl("p", { text: `Resolution: ${c.resolution}`, cls: "review-card-resolution" });
    }
    if (c.note) {
      card.createEl("p", { text: `Note: ${c.note}`, cls: "review-card-note" });
    }

    const actions = card.createDiv({ cls: "review-card-actions" });
    const jump = actions.createEl("button", { text: "Jump" });
    jump.onclick = () => this.jumpToAnchor(c);

    const edit = actions.createEl("button", { text: "Edit" });
    edit.onclick = () => this.editComment(c);

    if (c.status === "stale" && c.anchorContext) {
      const reattach = actions.createEl("button", { text: "Reattach" });
      reattach.onclick = async () => {
        if (!this.currentDocPath) return;
        try {
          const ok = await this.store.reattachComment(this.currentDocPath, c.id);
          if (ok) {
            new Notice(`Reattached ${c.id}`);
          } else {
            new Notice(`Could not find anchor context for ${c.id}`);
          }
        } catch (e) {
          new Notice(`Reattach failed: ${(e as Error).message}`);
        }
        this.render();
      };
    }

    const toggle = actions.createEl("button", {
      text: c.status === "open" ? "Resolve" : "Reopen",
    });
    toggle.onclick = async () => {
      if (!this.currentDocPath) return;
      const newStatus = c.status === "open" ? "resolved" : "open";
      await this.store.setStatus(this.currentDocPath, c.id, newStatus);
      this.render();
    };

    const del = actions.createEl("button", { text: "Delete" });
    del.onclick = async () => {
      if (!this.currentDocPath) return;
      await this.store.deleteComment(this.currentDocPath, c.id);
      this.render();
    };
  }

  private editComment(c: ReviewComment) {
    if (!this.currentDocPath) return;
    const docPath = this.currentDocPath;
    new AddCommentModal(
      this.app,
      async (body) => {
        if (body === c.body) return;
        await this.store.updateCommentBody(docPath, c.id, body);
        this.render();
      },
      { title: `Edit comment ${c.id}`, initialBody: c.body, submitLabel: "Update" }
    ).open();
  }

  private async jumpToAnchor(c: ReviewComment) {
    if (!this.currentDocPath) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentDocPath);
    if (!(file instanceof TFile)) return;
    const text = await this.app.vault.read(file);
    const idMatch = c.anchor.replace(/^\^/, "");
    const lineIndex = text.split("\n").findIndex((l) => l.includes(`^${idMatch}`));
    if (lineIndex === -1) {
      new Notice(`Anchor ${c.anchor} not found`);
      return;
    }
    const leaf = this.app.workspace
      .getLeavesOfType("markdown")
      .find((l) => (l.view as MarkdownView).file?.path === this.currentDocPath);
    if (!leaf) {
      new Notice("Source document is not open");
      return;
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    window.requestAnimationFrame(() => {
      const view = leaf.view as MarkdownView;
      if (!view.editor) return;
      view.editor.setCursor({ line: lineIndex, ch: 0 });
      view.editor.scrollIntoView(
        { from: { line: lineIndex, ch: 0 }, to: { line: lineIndex, ch: 0 } },
        true
      );
      view.editor.focus();
    });
  }
}
