import { CommentTarget } from "../sidecar";

const FENCE_RE = /^(\s*)(```+|~~~+)/;

function isFence(line: string): boolean {
  return FENCE_RE.test(line);
}

export function blockLineRange(
  lines: string[],
  anchorLineIdx: number,
  target: CommentTarget
): [number, number] {
  if (target === "heading" || target === "list-item" || target === "image") {
    return [anchorLineIdx, anchorLineIdx];
  }
  if (target === "paragraph") {
    let start = anchorLineIdx;
    while (start > 0 && lines[start - 1].trim() !== "") start--;
    return [start, anchorLineIdx];
  }
  if (target === "code-block") {
    let closeIdx = anchorLineIdx - 1;
    while (closeIdx >= 0 && !isFence(lines[closeIdx])) closeIdx--;
    if (closeIdx < 0) return [anchorLineIdx, anchorLineIdx];
    let openIdx = closeIdx - 1;
    while (openIdx >= 0 && !isFence(lines[openIdx])) openIdx--;
    if (openIdx < 0) return [closeIdx, anchorLineIdx];
    return [openIdx, anchorLineIdx];
  }
  if (target === "table") {
    let i = anchorLineIdx - 1;
    while (i >= 0 && lines[i].trim() === "") i--;
    let start = i;
    while (start >= 0 && lines[start].trimStart().startsWith("|")) start--;
    return [start + 1, anchorLineIdx];
  }
  if (target === "callout") {
    let start = anchorLineIdx;
    while (start > 0 && lines[start - 1].trimStart().startsWith(">")) start--;
    let end = anchorLineIdx;
    while (end + 1 < lines.length && lines[end + 1].trimStart().startsWith(">")) end++;
    return [start, end];
  }
  return [anchorLineIdx, anchorLineIdx];
}
