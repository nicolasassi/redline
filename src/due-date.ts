import { ReviewComment } from "./sidecar";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDueDate(value: string | undefined | null): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

export function isOverdue(comment: ReviewComment, today: string = todayIso()): boolean {
  if (comment.status !== "open") return false;
  if (!isValidDueDate(comment.due)) return false;
  return comment.due <= today;
}
