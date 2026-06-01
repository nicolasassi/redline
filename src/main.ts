import { Plugin, WorkspaceLeaf, MarkdownView, TFile, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { CommentStore, SIDECAR_SUFFIX } from "./comment-store";
import { registerAddCommentCommand } from "./commands";
import { ReviewSidebar, REVIEW_VIEW_TYPE } from "./ui/review-sidebar";
import {
  reviewGutterExtension,
  setGutterEntries,
  GutterEntry,
} from "./editor/gutter";
import { reviewHoverExtension, setHoverState } from "./editor/hover";
import { ReviewComment } from "./sidecar";
import {
  ReviewSettings,
  DEFAULT_SETTINGS,
  ReviewSettingTab,
} from "./settings";

export default class ReviewPlugin extends Plugin {
  store!: CommentStore;
  settings!: ReviewSettings;

  async onload() {
    await this.loadSettings();
    this.store = new CommentStore(this.app, this.settings);
    registerAddCommentCommand(this.app, this.store, (cmd) => this.addCommand(cmd));

    this.registerView(REVIEW_VIEW_TYPE, (leaf: WorkspaceLeaf) => new ReviewSidebar(leaf, this.store));
    this.registerEditorExtension(reviewGutterExtension());
    this.registerEditorExtension(reviewHoverExtension());

    this.addCommand({
      id: "toggle-sidebar",
      name: "Toggle sidebar",
      callback: () => this.toggleSidebar(),
    });

    this.addCommand({
      id: "jump-next-open",
      name: "Jump to next open comment",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const file = view?.file;
        if (!file || file.path.endsWith(".review.md")) return false;
        if (!checking) this.jumpToNextOpen(file.path);
        return true;
      },
    });

    this.addRibbonIcon("messages-square", "Redline sidebar", () => this.toggleSidebar());
    this.addSettingTab(new ReviewSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => {
      if (!ctx.sourcePath.endsWith(SIDECAR_SUFFIX)) return;
      const sourcePath = this.store.sourcePathFor(ctx.sourcePath);
      if (!sourcePath) return;
      this.injectArchivedActions(el, sourcePath);
    });

    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (file && !file.path.endsWith(".review.md")) {
          await this.store.markStaleAnchors(file.path);
        }
        await this.refreshGutter();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const activePath = view?.file?.path;
        if (!activePath) return;
        const sidecarPath = this.store.sidecarPathFor(activePath);
        if (file.path !== activePath && file.path !== sidecarPath) return;
        this.refreshGutter();
      })
    );
    console.log("redline: loaded");
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async toggleSidebar() {
    const existing = this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE);
    if (existing.length) {
      this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: REVIEW_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private async jumpToNextOpen(docPath: string) {
    const sidecar = await this.store.readSidecar(docPath);
    if (!sidecar) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.editor) return;
    const lines = view.editor.getValue().split("\n");
    const cursorLine = view.editor.getCursor("from").line;
    const candidates = sidecar.comments
      .filter((c) => c.status === "open")
      .map((c) => {
        const idMatch = c.anchor.replace(/^\^/, "");
        return { line: lines.findIndex((l) => l.includes(`^${idMatch}`)), id: c.id };
      })
      .filter((e) => e.line >= 0)
      .sort((a, b) => a.line - b.line);
    if (candidates.length === 0) {
      new Notice("No open comments");
      return;
    }
    const next = candidates.find((e) => e.line > cursorLine) ?? candidates[0];
    view.editor.setCursor({ line: next.line, ch: 0 });
    view.editor.scrollIntoView(
      { from: { line: next.line, ch: 0 }, to: { line: next.line, ch: 0 } },
      true
    );
    new Notice(`Jumped to ${next.id}`);
  }

  private injectArchivedActions(el: HTMLElement, sourcePath: string) {
    const callouts = el.querySelectorAll<HTMLElement>('.callout[data-callout="review-comment"]');
    callouts.forEach((callout) => {
      const titleEl = callout.querySelector(".callout-title-inner");
      if (!titleEl) return;
      const titleText = titleEl.textContent ?? "";
      const m = titleText.match(/^\s*(\S+)\s*·\s*(\S+)/);
      if (!m) return;
      const [, id, status] = m;
      if (status !== "archived") return;
      if (callout.querySelector(".review-archived-actions")) return;

      const actions = callout.createDiv({ cls: "review-archived-actions" });
      const restore = actions.createEl("button", { text: "Bring back", cls: "review-restore-btn" });
      restore.onclick = async () => {
        try {
          await this.store.restoreComment(sourcePath, id);
          new Notice(`Restored ${id}`);
        } catch (e) {
          new Notice(`Restore failed: ${(e as Error).message}`);
        }
      };
      const del = actions.createEl("button", { text: "Delete", cls: "review-delete-btn" });
      del.onclick = async () => {
        try {
          await this.store.deleteComment(sourcePath, id);
          new Notice(`Deleted ${id}`);
        } catch (e) {
          new Notice(`Delete failed: ${(e as Error).message}`);
        }
      };
    });
  }

  private async refreshGutter() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;
    const file = view.file;
    if (!(file instanceof TFile) || file.path.endsWith(".review.md")) return;

    const sidecar = await this.store.readSidecar(file.path);
    if (!sidecar) return;

    const text = await this.app.vault.read(file);
    const lines = text.split("\n");
    const entries: GutterEntry[] = [];
    const byAnchor = new Map<string, ReviewComment>();
    for (const c of sidecar.comments) {
      if (c.status === "archived") continue;
      const idMatch = c.anchor.replace(/^\^/, "");
      const lineIndex = lines.findIndex((l) => l.includes(`^${idMatch}`));
      if (lineIndex >= 0) entries.push({ line: lineIndex, status: c.status });
      if (idMatch) byAnchor.set(idMatch, c);
    }

    const docPath = file.path;
    const onArchive = async (commentId: string) => {
      try {
        await this.store.archiveComment(docPath, commentId);
        new Notice(`Archived ${commentId}`);
        await this.refreshGutter();
      } catch (err) {
        new Notice(`Archive failed: ${(err as Error).message}`);
      }
    };

    // @ts-expect-error access internal CM6 editor
    const cm: EditorView | undefined = view.editor.cm;
    if (cm) {
      cm.dispatch({
        effects: [
          setGutterEntries.of(entries),
          setHoverState.of({ comments: byAnchor, docPath, onArchive, app: this.app }),
        ],
      });
    }
  }
}
