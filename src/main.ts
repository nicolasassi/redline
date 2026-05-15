import { Plugin, WorkspaceLeaf, MarkdownView, TFile, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { CommentStore } from "./comment-store";
import { registerAddCommentCommand } from "./commands";
import { ReviewSidebar, REVIEW_VIEW_TYPE } from "./ui/review-sidebar";
import {
  reviewGutterExtension,
  setGutterEntries,
  GutterEntry,
} from "./editor/gutter";
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
        if (!checking) this.jumpToNextOpen(file.path);
        return true;
      },
    });

    this.addRibbonIcon("messages-square", "Review sidebar", () => this.toggleSidebar());
    this.addSettingTab(new ReviewSettingTab(this.app, this));

    this.registerEvent(this.app.workspace.on("file-open", () => this.refreshGutter()));
    this.registerEvent(this.app.vault.on("modify", () => this.refreshGutter()));

    console.log("obsidian-review: loaded");
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
    for (const c of sidecar.comments) {
      const idMatch = c.anchor.replace(/^\^/, "");
      const lineIndex = lines.findIndex((l) => l.includes(`^${idMatch}`));
      if (lineIndex >= 0) entries.push({ line: lineIndex, status: c.status });
    }

    // @ts-expect-error access internal CM6 editor
    const cm: EditorView | undefined = view.editor.cm;
    if (cm) {
      cm.dispatch({ effects: setGutterEntries.of(entries) });
    }
  }
}
