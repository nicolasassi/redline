import { describe, it, expect } from "vitest";
import { buildRow } from "./dashboard-row";
import { ReviewComment } from "../sidecar";

function mkComment(over: Partial<ReviewComment>): ReviewComment {
  return {
    id: "c1",
    status: "open",
    target: "paragraph",
    anchor: "^abc123",
    created: "2026-01-01T00:00:00.000Z",
    body: "x",
    ...over,
  } as ReviewComment;
}

describe("buildRow", () => {
  const today = "2026-06-01";

  it("counts open / stale / resolved and ignores archived", () => {
    const row = buildRow("doc.md", [
      mkComment({ id: "a", status: "open" }),
      mkComment({ id: "b", status: "open" }),
      mkComment({ id: "c", status: "stale" }),
      mkComment({ id: "d", status: "resolved" }),
      mkComment({ id: "e", status: "archived" }),
    ], today);
    expect(row.open).toBe(2);
    expect(row.stale).toBe(1);
    expect(row.resolved).toBe(1);
  });

  it("flags overdue open comments only", () => {
    const row = buildRow("doc.md", [
      mkComment({ id: "a", status: "open", due: "2026-05-01" }),
      mkComment({ id: "b", status: "open", due: "2026-12-01" }),
      mkComment({ id: "c", status: "resolved", due: "2026-01-01" }),
    ], today);
    expect(row.overdue).toBe(1);
  });

  it("picks the oldest open created date and earliest due", () => {
    const row = buildRow("doc.md", [
      mkComment({ id: "a", status: "open", created: "2026-03-01T00:00:00.000Z", due: "2026-07-01" }),
      mkComment({ id: "b", status: "open", created: "2026-01-15T00:00:00.000Z", due: "2026-04-01" }),
      mkComment({ id: "c", status: "open", created: "2026-02-10T00:00:00.000Z" }),
    ], today);
    expect(row.oldestOpen).toBe("2026-01-15T00:00:00.000Z");
    expect(row.earliestDue).toBe("2026-04-01");
  });

  it("returns nulls for oldestOpen / earliestDue when no open comments", () => {
    const row = buildRow("doc.md", [
      mkComment({ id: "a", status: "resolved", due: "2026-04-01" }),
    ], today);
    expect(row.oldestOpen).toBeNull();
    expect(row.earliestDue).toBeNull();
  });
});
