import { App, Editor, MarkdownView, Notice } from "obsidian";
import { CommentStore } from "./comment-store";
import { AddCommentModal } from "./ui/add-comment-modal";
import { CommentTarget } from "./sidecar";

function inferTarget(editor: Editor, line: number): CommentTarget {
  const text = editor.getLine(line);
  if (/^#{1,6}\s/.test(text)) return "heading";
  if (/^\s*[-*+]\s/.test(text) || /^\s*\d+\.\s/.test(text)) return "list-item";
  if (/!\[\[.+\]\]/.test(text) || /!\[.*\]\(.+\)/.test(text)) return "image";
  if (/^>\s/.test(text)) return "callout";
  if (/^```/.test(text)) return "code-block";
  if (/^\|/.test(text)) return "table";
  return "paragraph";
}

export function registerAddCommentCommand(
  app: App,
  store: CommentStore,
  addCommand: (cmd: {
    id: string;
    name: string;
    editorCallback: (editor: Editor, view: MarkdownView) => void;
  }) => void
) {
  addCommand({
    id: "add-comment-at-cursor",
    name: "Add comment at cursor",
    editorCallback: (editor, view) => {
      const file = view.file;
      if (!file) {
        new Notice("No active file");
        return;
      }
      const cursorLine = editor.getCursor("from").line;
      if (editor.getLine(cursorLine).trim() === "") {
        new Notice("Cannot anchor a comment on an empty line");
        return;
      }
      const target = inferTarget(editor, cursorLine);
      new AddCommentModal(app, async (body) => {
        try {
          const comment = await store.addComment(file.path, cursorLine, target, body);
          new Notice(`Comment added (${comment.id})`);
        } catch (e) {
          new Notice(`Failed to add comment: ${(e as Error).message}`);
        }
      }).open();
    },
  });
}
