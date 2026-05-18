import type { CommentTarget } from "./sidecar";

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateBlockId(existing: Set<string>): string {
  while (true) {
    let id = "";
    for (let i = 0; i < 6; i++) {
      id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    }
    if (!existing.has(id)) return id;
  }
}

export function findExistingBlockId(line: string): string | null {
  const match = line.match(/\^([a-z0-9]{6})\s*$/);
  return match ? match[1] : null;
}

export function findAllBlockIds(doc: string): Set<string> {
  const ids = new Set<string>();
  const re = /\^([a-z0-9]{6})(?![a-z0-9])/g;
  for (const m of doc.matchAll(re)) {
    ids.add(m[1]);
  }
  return ids;
}

export interface InjectResult {
  text: string;
  id: string;
}

const FENCE_RE = /^(\s*)(```+|~~~+)/;

function isFenceLine(line: string): { fence: string; indent: string } | null {
  const m = line.match(FENCE_RE);
  if (!m) return null;
  return { indent: m[1], fence: m[2] };
}

function findClosingFence(lines: string[], openIdx: number): number {
  const open = isFenceLine(lines[openIdx]);
  if (!open) return -1;
  // Match a closing fence of the same character with length >= opening fence length.
  const fenceChar = open.fence[0];
  const minLen = open.fence.length;
  for (let i = openIdx + 1; i < lines.length; i++) {
    const close = isFenceLine(lines[i]);
    if (close && close.fence[0] === fenceChar && close.fence.length >= minLen) {
      return i;
    }
  }
  return -1;
}

function findTableEnd(lines: string[], startIdx: number): number {
  let end = startIdx;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("|")) {
      end = i;
    } else {
      break;
    }
  }
  return end;
}

function findCalloutEnd(lines: string[], startIdx: number): number {
  let end = startIdx;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith(">")) {
      end = i;
    } else {
      break;
    }
  }
  return end;
}

function existingIdInDoc(lines: string[], targetIdx: number, target: CommentTarget): string | null {
  // For end-of-line placement targets, look at the line itself.
  if (target === "paragraph" || target === "heading" || target === "list-item" || target === "image") {
    return findExistingBlockId(lines[targetIdx]);
  }
  // For code-block, check the line right after closing fence.
  if (target === "code-block") {
    const close = findClosingFence(lines, targetIdx);
    if (close === -1) return findExistingBlockId(lines[targetIdx]);
    const after = lines[close + 1];
    if (after !== undefined) {
      const m = after.match(/^\^([a-z0-9]{6})(?![a-z0-9])\s*$/);
      if (m) return m[1];
    }
    return null;
  }
  if (target === "table") {
    const end = findTableEnd(lines, targetIdx);
    const after = lines[end + 1];
    if (after !== undefined) {
      const m = after.match(/^\^([a-z0-9]{6})(?![a-z0-9])\s*$/);
      if (m) return m[1];
    }
    return null;
  }
  if (target === "callout") {
    const end = findCalloutEnd(lines, targetIdx);
    // Check if last callout line ends with an id, or if next callout-prefixed line is just `> ^id`.
    const lastLine = lines[end];
    const inline = findExistingBlockId(lastLine);
    if (inline) return inline;
    return null;
  }
  return null;
}

export interface RemoveResult {
  text: string;
  anchorLine: string | null;
}

export function removeBlockId(doc: string, anchorId: string): RemoveResult {
  const lines = doc.split("\n");
  const inlineRe = new RegExp(`\\s*\\^${anchorId}(?![a-z0-9])`);
  const standaloneRe = new RegExp(`^\\s*\\^${anchorId}\\s*$`);
  const calloutStandaloneRe = new RegExp(`^\\s*>\\s*\\^${anchorId}\\s*$`);

  for (let i = 0; i < lines.length; i++) {
    if (standaloneRe.test(lines[i])) {
      // Walk back to the last non-blank line before the anchor — that's its context.
      let ctxIdx = i - 1;
      while (ctxIdx >= 0 && lines[ctxIdx].trim() === "") ctxIdx--;
      const anchorLine = ctxIdx >= 0 ? lines[ctxIdx] : null;

      const prevBlank = i > 0 && lines[i - 1].trim() === "";
      if (prevBlank) {
        lines.splice(i - 1, 2);
      } else {
        lines.splice(i, 1);
      }
      return { text: lines.join("\n"), anchorLine };
    }
    if (calloutStandaloneRe.test(lines[i])) {
      const anchorLine = i > 0 ? lines[i - 1] : null;
      lines.splice(i, 1);
      return { text: lines.join("\n"), anchorLine };
    }
    if (inlineRe.test(lines[i])) {
      const cleaned = lines[i].replace(inlineRe, "");
      lines[i] = cleaned;
      return { text: lines.join("\n"), anchorLine: cleaned };
    }
  }
  return { text: doc, anchorLine: null };
}

export function injectBlockId(
  doc: string,
  lineNumber: number,
  target: CommentTarget,
  candidateId: string
): InjectResult {
  const lines = doc.split("\n");

  const existing = existingIdInDoc(lines, lineNumber, target);
  if (existing) return { text: doc, id: existing };

  if (target === "paragraph" || target === "heading" || target === "list-item" || target === "image") {
    const trimmed = lines[lineNumber].trimEnd();
    lines[lineNumber] = `${trimmed} ^${candidateId}`;
    return { text: lines.join("\n"), id: candidateId };
  }

  if (target === "code-block") {
    const close = findClosingFence(lines, lineNumber);
    if (close === -1) {
      // Fallback: end-of-line placement.
      const trimmed = lines[lineNumber].trimEnd();
      lines[lineNumber] = `${trimmed} ^${candidateId}`;
      return { text: lines.join("\n"), id: candidateId };
    }
    // Insert `^id` on its own line right after the closing fence.
    lines.splice(close + 1, 0, `^${candidateId}`);
    return { text: lines.join("\n"), id: candidateId };
  }

  if (target === "table") {
    const end = findTableEnd(lines, lineNumber);
    // Insert a blank line then `^id` after the table.
    lines.splice(end + 1, 0, "", `^${candidateId}`);
    return { text: lines.join("\n"), id: candidateId };
  }

  if (target === "callout") {
    const end = findCalloutEnd(lines, lineNumber);
    // Append a new `> ^id` line at the end of the callout.
    lines.splice(end + 1, 0, `> ^${candidateId}`);
    return { text: lines.join("\n"), id: candidateId };
  }

  // Should be unreachable, but keep a safe default.
  const trimmed = lines[lineNumber].trimEnd();
  lines[lineNumber] = `${trimmed} ^${candidateId}`;
  return { text: lines.join("\n"), id: candidateId };
}
