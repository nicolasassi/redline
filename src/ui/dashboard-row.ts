import { ReviewComment } from "../sidecar";
import { isOverdue } from "../due-date";

export interface DocRow {
  sourcePath: string;
  open: number;
  stale: number;
  overdue: number;
  resolved: number;
  oldestOpen: string | null;
  earliestDue: string | null;
}

export function buildRow(
  sourcePath: string,
  comments: ReviewComment[],
  today: string
): DocRow {
  let open = 0;
  let stale = 0;
  let overdue = 0;
  let resolved = 0;
  let oldestOpen: string | null = null;
  let earliestDue: string | null = null;
  for (const c of comments) {
    if (c.status === "archived") continue;
    if (c.status === "open") {
      open++;
      if (!oldestOpen || c.created < oldestOpen) oldestOpen = c.created;
      if (c.due && (!earliestDue || c.due < earliestDue)) earliestDue = c.due;
    }
    if (c.status === "stale") stale++;
    if (c.status === "resolved") resolved++;
    if (isOverdue(c, today)) overdue++;
  }
  return { sourcePath, open, stale, overdue, resolved, oldestOpen, earliestDue };
}
