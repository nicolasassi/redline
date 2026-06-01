import { describe, it, expect } from "vitest";
import { isOverdue, isValidDueDate, todayIso } from "./due-date";
import { ReviewComment } from "./sidecar";

const baseComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
  id: "c1",
  status: "open",
  anchor: "^abc123",
  target: "paragraph",
  created: "2026-01-01T00:00:00Z",
  body: "test",
  ...overrides,
});

describe("isValidDueDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isValidDueDate("2026-06-01")).toBe(true);
  });

  it("rejects undefined / null / empty", () => {
    expect(isValidDueDate(undefined)).toBe(false);
    expect(isValidDueDate(null)).toBe(false);
    expect(isValidDueDate("")).toBe(false);
  });

  it("rejects non-iso shapes", () => {
    expect(isValidDueDate("06/01/2026")).toBe(false);
    expect(isValidDueDate("2026-6-1")).toBe(false);
    expect(isValidDueDate("2026-06-01T00:00:00Z")).toBe(false);
  });
});

describe("isOverdue", () => {
  it("is false for comments with no due date", () => {
    expect(isOverdue(baseComment(), "2026-06-01")).toBe(false);
  });

  it("is true when due date is in the past", () => {
    expect(isOverdue(baseComment({ due: "2026-05-30" }), "2026-06-01")).toBe(true);
  });

  it("is true when due date equals today", () => {
    expect(isOverdue(baseComment({ due: "2026-06-01" }), "2026-06-01")).toBe(true);
  });

  it("is false when due date is in the future", () => {
    expect(isOverdue(baseComment({ due: "2026-06-02" }), "2026-06-01")).toBe(false);
  });

  it("is false for resolved / stale / archived even when past due", () => {
    expect(isOverdue(baseComment({ due: "2025-01-01", status: "resolved" }), "2026-06-01")).toBe(false);
    expect(isOverdue(baseComment({ due: "2025-01-01", status: "stale" }), "2026-06-01")).toBe(false);
    expect(isOverdue(baseComment({ due: "2025-01-01", status: "archived" }), "2026-06-01")).toBe(false);
  });

  it("is false when due date is malformed", () => {
    expect(isOverdue(baseComment({ due: "yesterday" }), "2026-06-01")).toBe(false);
  });
});

describe("todayIso", () => {
  it("formats a Date as YYYY-MM-DD using local fields", () => {
    expect(todayIso(new Date(2026, 5, 1, 14, 30))).toBe("2026-06-01");
    expect(todayIso(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
});
