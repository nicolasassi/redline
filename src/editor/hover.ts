import { hoverTooltip, Tooltip, EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { App, Component, MarkdownRenderer } from "obsidian";
import { ReviewComment } from "../sidecar";
import { isOverdue, todayIso } from "../due-date";
import { blockLineRange } from "./block-range";

export interface HoverState {
  comments: Map<string, ReviewComment>;
  docPath: string | null;
  onArchive: ((commentId: string) => void) | null;
  app: App | null;
}

const EMPTY_STATE: HoverState = {
  comments: new Map(),
  docPath: null,
  onArchive: null,
  app: null,
};

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

interface AnchoredRange {
  comment: ReviewComment;
  from: number;
  to: number;
}

function computeAnchorRanges(view: EditorView, comments: Map<string, ReviewComment>): AnchoredRange[] {
  const doc = view.state.doc;
  const lines = doc.toString().split("\n");
  const result: AnchoredRange[] = [];

  for (const c of comments.values()) {
    const anchorId = c.anchor.replace(/^\^/, "");
    if (!anchorId) continue;
    const re = new RegExp(`\\^${anchorId}(?![a-z0-9])`);
    const anchorLineIdx = lines.findIndex((l) => re.test(l));
    if (anchorLineIdx < 0) continue;
    const [startLine, endLine] = blockLineRange(lines, anchorLineIdx, c.target);
    const fromPos = doc.line(startLine + 1).from;
    const toPos = doc.line(endLine + 1).to;
    result.push({ comment: c, from: fromPos, to: toPos });
  }
  return result;
}

function renderTooltipDom(
  comment: ReviewComment,
  state: HoverState,
  component: Component
): HTMLElement {
  const dom = document.createElement("div");
  dom.addClass("review-hover-tooltip");
  dom.addClass(`review-hover-${comment.status}`);

  const header = dom.createDiv({ cls: "review-hover-header" });
  header.createSpan({ cls: "review-hover-id", text: comment.id });
  header.createSpan({ cls: "review-hover-status", text: comment.status });

  const meta = dom.createDiv({ cls: "review-hover-meta" });
  meta.setText(`${comment.target} · ${comment.created.slice(0, 10)}`);

  if (comment.due) {
    const overdue = isOverdue(comment, todayIso());
    const dueEl = dom.createDiv({ cls: "review-hover-due" });
    dueEl.setText(`Due ${comment.due}${overdue ? " · overdue" : ""}`);
    if (overdue) dueEl.addClass("review-hover-due-overdue");
  }

  const body = dom.createDiv({ cls: "review-hover-body" });
  const markdown = comment.body || "*(no body)*";
  if (state.app && state.docPath) {
    void MarkdownRenderer.render(state.app, markdown, body, state.docPath, component);
  } else {
    body.setText(comment.body || "(no body)");
  }

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
  const ranges = computeAnchorRanges(view, state.comments);
  const hit = ranges.find((r) => pos >= r.from && pos <= r.to);
  if (!hit) return null;
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create: () => {
      const component = new Component();
      component.load();
      const dom = renderTooltipDom(hit.comment, state, component);
      return {
        dom,
        destroy: () => component.unload(),
      };
    },
  };
});

export function reviewHoverExtension() {
  return [hoverStateField, reviewHoverTooltip];
}
