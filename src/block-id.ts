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
  const re = /\^([a-z0-9]{6})/g;
  for (const m of doc.matchAll(re)) {
    ids.add(m[1]);
  }
  return ids;
}

export interface InjectResult {
  text: string;
  id: string;
}

export function injectBlockId(
  doc: string,
  lineNumber: number,
  target: CommentTarget,
  candidateId: string
): InjectResult {
  const lines = doc.split("\n");
  const line = lines[lineNumber];
  const existing = findExistingBlockId(line);
  if (existing) return { text: doc, id: existing };

  const trimmed = line.trimEnd();
  lines[lineNumber] = `${trimmed} ^${candidateId}`;
  return { text: lines.join("\n"), id: candidateId };
}
