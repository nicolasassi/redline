import { gutter, GutterMarker } from "@codemirror/view";
import { StateField, StateEffect, EditorState, RangeSet } from "@codemirror/state";
import { CommentStatus } from "../sidecar";

class CommentMarker extends GutterMarker {
  constructor(private status: CommentStatus, private overdue: boolean) {
    super();
  }
  toDOM() {
    const el = document.createElement("div");
    el.addClass("review-gutter-dot");
    el.addClass(`review-gutter-${this.status}`);
    if (this.overdue) el.addClass("review-gutter-overdue");
    return el;
  }
}

export interface GutterEntry {
  line: number;
  status: CommentStatus;
  overdue?: boolean;
}

export const setGutterEntries = StateEffect.define<GutterEntry[]>();

const gutterField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setGutterEntries)) {
        const markers = effect.value
          .filter((e) => e.line >= 0 && e.line < tr.state.doc.lines)
          .sort((a, b) => a.line - b.line)
          .map((e) => {
            const linePos = tr.state.doc.line(e.line + 1).from;
            return new CommentMarker(e.status, !!e.overdue).range(linePos);
          });
        next = RangeSet.of(markers);
      }
    }
    return next;
  },
});

export function reviewGutterExtension() {
  return [
    gutterField,
    gutter({
      class: "review-gutter",
      markers: (view) => view.state.field(gutterField),
    }),
  ];
}
