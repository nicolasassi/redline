import { Plugin, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
import { CommentStore } from "./comment-store";
import { registerAddCommentCommand } from "./commands";
import { ReviewSidebar, REVIEW_VIEW_TYPE } from "./ui/review-sidebar";

export default class ReviewPlugin extends Plugin {
  store!: CommentStore;

  async onload() {
    this.store = new CommentStore(this.app);
    registerAddCommentCommand(this.app, this.store, (cmd) => this.addCommand(cmd));

    this.registerView(REVIEW_VIEW_TYPE, (leaf: WorkspaceLeaf) => new ReviewSidebar(leaf, this.store));

    this.addCommand({
      id: "toggle-sidebar",
      name: "Toggle sidebar",
      callback: () => this.toggleSidebar(),
    });

    this.addCommand({
      id: "copy-prompt",
      name: "Copy prompt for Claude Code",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const path = view?.file?.path;
        if (!path || path.endsWith(".review.md")) return false;
        if (!checking) {
          navigator.clipboard.writeText(`/review-act ${path}`);
          new Notice("Copied to clipboard");
        }
        return true;
      },
    });

    this.addCommand({
      id: "jump-next-open",
      name: "Jump to next open comment",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const file = view?.file;
        if (!file || file.path.endsWith(".review.md")) return false;
        if (!checking) {
          this.jumpToNextOpen(file.path);
        }
        return true;
      },
    });

    this.addRibbonIcon("messages-square", "Review sidebar", () => this.toggleSidebar());

    console.log("obsidian-review: loaded");
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
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

    const text = view.editor.getValue();
    const lines = text.split("\n");
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
}
