export type CommentStatus = "open" | "resolved" | "stale";

export type CommentTarget =
  | "paragraph"
  | "heading"
  | "list-item"
  | "image"
  | "code-block"
  | "callout"
  | "table";

export interface ReviewComment {
  id: string;
  status: CommentStatus;
  anchor: string;
  target: CommentTarget;
  created: string;
  resolved?: string;
  resolution?: string;
  note?: string;
  body: string;
}

export interface Sidecar {
  reviewFor: string;
  formatVersion: number;
  updated: string;
  comments: ReviewComment[];
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const CALLOUT_RE = /^> \[!review-comment\]\+? (\S+) · (\S+)\s*$/;

export function parseSidecar(text: string): Sidecar {
  const fmMatch = text.match(FRONTMATTER_RE);
  if (!fmMatch) {
    throw new Error("Sidecar missing frontmatter");
  }
  const fm = parseFrontmatter(fmMatch[1]);
  const formatVersion = parseInt(fm.format_version ?? "0", 10);
  if (formatVersion !== 1) {
    throw new Error(`Unsupported format_version: ${fm.format_version ?? ""}`);
  }
  const body = text.slice(fmMatch[0].length);

  const comments: ReviewComment[] = [];
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const calloutMatch = line.match(CALLOUT_RE);
    if (!calloutMatch) {
      i++;
      continue;
    }
    const [, id, statusRaw] = calloutMatch;
    const status = statusRaw as CommentStatus;
    i++;

    const metadata: Record<string, string> = {};
    const bodyLines: string[] = [];
    let inBody = false;

    while (i < lines.length && lines[i].startsWith(">")) {
      const stripped = lines[i].replace(/^>\s?/, "");
      if (!inBody && stripped.trim() === "") {
        inBody = true;
        i++;
        continue;
      }
      if (!inBody) {
        const kvMatch = stripped.match(/^(\w+):\s*(.*)$/);
        if (kvMatch) {
          metadata[kvMatch[1]] = kvMatch[2];
        }
      } else {
        bodyLines.push(stripped);
      }
      i++;
    }

    comments.push({
      id,
      status,
      anchor: metadata.anchor ?? "",
      target: metadata.target as CommentTarget,
      created: metadata.created ?? "",
      resolved: metadata.resolved,
      resolution: metadata.resolution,
      note: metadata.note,
      body: bodyLines.join("\n").trimEnd(),
    });
  }

  return {
    reviewFor: fm.review_for ?? "",
    formatVersion,
    updated: fm.updated ?? "",
    comments,
  };
}

function parseFrontmatter(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

export function serializeSidecar(sidecar: Sidecar): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`review_for: ${sidecar.reviewFor}`);
  lines.push(`format_version: ${sidecar.formatVersion}`);
  lines.push(`updated: ${sidecar.updated}`);
  lines.push("---");
  lines.push("");
  lines.push(`# Review: ${sidecar.reviewFor}`);
  lines.push("");

  for (const c of sidecar.comments) {
    const fold = c.status === "open" ? "+" : "";
    lines.push(`> [!review-comment]${fold} ${c.id} · ${c.status}`);
    lines.push(`> anchor: ${c.anchor}`);
    lines.push(`> target: ${c.target}`);
    lines.push(`> created: ${c.created}`);
    if (c.resolved) lines.push(`> resolved: ${c.resolved}`);
    if (c.resolution) lines.push(`> resolution: ${c.resolution}`);
    if (c.note) lines.push(`> note: ${c.note}`);
    lines.push(">");
    for (const bodyLine of c.body.split("\n")) {
      lines.push(`> ${bodyLine}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
