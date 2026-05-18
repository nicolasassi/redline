import { hoverTooltip, Tooltip, EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { ReviewComment } from "../sidecar";

const BLOCK_ID_RE = /\^([a-z0-9]{6})(?![a-z0-9])/g;

export interface HoverState {
  comments: Map<string, ReviewComment>;
  docPath: string | null;
  onArchive: ((commentId: string) => void) | null;
}

const EMPTY_STATE: HoverState = { comments: new Map(), docPath: null, onArchive: null };

export const setHoverState = StateEffect.define<HoverState>();

const hoverStateField = StateField.define<HoverState>({
  create() {
    return EMPTY_STATE;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHoverState)) return effect.value;
    }
    return value;
  },
});

function blockIdAt(view: EditorView, pos: number): { id: string; from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const offset = pos - line.from;
  BLOCK_ID_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_ID_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return { id: match[1], from: line.from + start, to: line.from + end };
    }
  }
  return null;
}

function renderTooltip(comment: ReviewComment, state: HoverState): HTMLElement {
  const dom = document.createElement("div");
  dom.addClass("review-hover-tooltip");
  dom.addClass(`review-hover-${comment.status}`);

  const header = dom.createDiv({ cls: "review-hover-header" });
  header.createSpan({ cls: "review-hover-id", text: comment.id });
  header.createSpan({ cls: "review-hover-status", text: comment.status });

  const meta = dom.createDiv({ cls: "review-hover-meta" });
  meta.setText(`${comment.target} · ${comment.created.slice(0, 10)}`);

  const body = dom.createDiv({ cls: "review-hover-body" });
  body.setText(comment.body || "(no body)");

  if (comment.resolution) {
    const res = dom.createDiv({ cls: "review-hover-resolution" });
    res.setText(`resolution: ${comment.resolution}`);
  }
  if (comment.note) {
    const note = dom.createDiv({ cls: "review-hover-note" });
    note.setText(comment.note);
  }

  if (state.onArchive && comment.status !== "archived") {
    const actions = dom.createDiv({ cls: "review-hover-actions" });
    const archiveBtn = actions.createEl("button", {
      cls: "review-hover-archive",
      text: "Archive",
    });
    archiveBtn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.onArchive?.(comment.id);
    };
  }

  return dom;
}

const reviewHoverTooltip = hoverTooltip((view, pos): Tooltip | null => {
  const state = view.state.field(hoverStateField, false);
  if (!state || state.comments.size === 0) return null;
  const hit = blockIdAt(view, pos);
  if (!hit) return null;
  const comment = state.comments.get(hit.id);
  if (!comment) return null;
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create: () => ({ dom: renderTooltip(comment, state) }),
  };
});

export function reviewHoverExtension() {
  return [hoverStateField, reviewHoverTooltip];
}
