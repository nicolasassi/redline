import { App, TFile, normalizePath } from "obsidian";
import {
  parseSidecar,
  serializeSidecar,
  ReviewComment,
  CommentTarget,
  Sidecar,
} from "./sidecar";
import {
  generateBlockId,
  findAllBlockIds,
  injectBlockId,
  removeBlockId,
} from "./block-id";

export const SIDECAR_SUFFIX = ".review.md";

export class CommentStore {
  constructor(
    private app: App,
    private settings: { sidecarLocation: "alongside" | "central"; centralFolder: string }
  ) {}

  sidecarPathFor(docPath: string): string {
    if (this.settings.sidecarLocation === "central") {
      const safe = docPath.replace(/\//g, "__");
      return normalizePath(`${this.settings.centralFolder}/${safe}${SIDECAR_SUFFIX}`);
    }
    return normalizePath(docPath + SIDECAR_SUFFIX);
  }

  sourcePathFor(sidecarPath: string): string | null {
    if (!sidecarPath.endsWith(SIDECAR_SUFFIX)) return null;
    if (this.settings.sidecarLocation === "central") {
      const folder = normalizePath(this.settings.centralFolder).replace(/\/$/, "") + "/";
      if (!sidecarPath.startsWith(folder)) return null;
      const stem = sidecarPath.slice(folder.length, sidecarPath.length - SIDECAR_SUFFIX.length);
      return stem.replace(/__/g, "/");
    }
    return sidecarPath.slice(0, sidecarPath.length - SIDECAR_SUFFIX.length);
  }

  async readSidecar(docPath: string): Promise<Sidecar | null> {
    const path = this.sidecarPathFor(docPath);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    const text = await this.app.vault.read(file);
    return parseSidecar(text);
  }

  async writeSidecar(docPath: string, sidecar: Sidecar): Promise<void> {
    const path = this.sidecarPathFor(docPath);
    sidecar.updated = new Date().toISOString();
    const text = serializeSidecar(sidecar);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, text);
    } else {
      await this.app.vault.create(path, text);
    }
  }

  async addComment(
    docPath: string,
    lineNumber: number,
    target: CommentTarget,
    body: string
  ): Promise<ReviewComment> {
    const docFile = this.app.vault.getAbstractFileByPath(docPath);
    if (!(docFile instanceof TFile)) throw new Error(`source doc not found: ${docPath}`);
    const docText = await this.app.vault.read(docFile);

    const existingIds = findAllBlockIds(docText);
    const candidate = generateBlockId(existingIds);
    const { text: newDocText, id: anchorId } = injectBlockId(
      docText,
      lineNumber,
      target,
      candidate
    );
    if (newDocText !== docText) {
      await this.app.vault.modify(docFile, newDocText);
    }

    const sidecar = (await this.readSidecar(docPath)) ?? {
      reviewFor: docPath,
      formatVersion: 1,
      updated: new Date().toISOString(),
      comments: [],
    };
    const highest = sidecar.comments.reduce((max, c) => {
      const m = c.id.match(/^c(\d+)$/);
      const n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    const nextId = `c${highest + 1}`;
    const comment: ReviewComment = {
      id: nextId,
      status: "open",
      anchor: `^${anchorId}`,
      target,
      created: new Date().toISOString(),
      body,
    };
    sidecar.comments.push(comment);
    await this.writeSidecar(docPath, sidecar);
    return comment;
  }

  async setStatus(
    docPath: string,
    commentId: string,
    status: ReviewComment["status"]
  ): Promise<void> {
    const sidecar = await this.readSidecar(docPath);
    if (!sidecar) throw new Error("no sidecar");
    const comment = sidecar.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error(`comment not found: ${commentId}`);
    comment.status = status;
    if (status === "resolved") comment.resolved = new Date().toISOString();
    await this.writeSidecar(docPath, sidecar);
  }

  async deleteComment(docPath: string, commentId: string): Promise<void> {
    const sidecar = await this.readSidecar(docPath);
    if (!sidecar) return;
    sidecar.comments = sidecar.comments.filter((c) => c.id !== commentId);
    await this.writeSidecar(docPath, sidecar);
  }

  async archiveComment(docPath: string, commentId: string): Promise<void> {
    const sidecar = await this.readSidecar(docPath);
    if (!sidecar) throw new Error("no sidecar");
    const comment = sidecar.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error(`comment not found: ${commentId}`);
    if (comment.status === "archived") return;

    const docFile = this.app.vault.getAbstractFileByPath(docPath);
    if (docFile instanceof TFile) {
      const text = await this.app.vault.read(docFile);
      const anchorId = comment.anchor.replace(/^\^/, "");
      const { text: cleaned, anchorLine } = removeBlockId(text, anchorId);
      if (cleaned !== text) {
        await this.app.vault.modify(docFile, cleaned);
      }
      if (anchorLine !== null) {
        comment.anchorContext = anchorLine.trim();
      }
    }
    comment.previousStatus = comment.status;
    comment.status = "archived";
    await this.writeSidecar(docPath, sidecar);
  }

  async restoreComment(docPath: string, commentId: string): Promise<void> {
    const sidecar = await this.readSidecar(docPath);
    if (!sidecar) throw new Error("no sidecar");
    const comment = sidecar.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error(`comment not found: ${commentId}`);
    if (comment.status !== "archived") return;

    const docFile = this.app.vault.getAbstractFileByPath(docPath);
    const anchorId = comment.anchor.replace(/^\^/, "");
    let restored = false;

    if (docFile instanceof TFile && comment.anchorContext) {
      const text = await this.app.vault.read(docFile);
      const lines = text.split("\n");
      const needle = comment.anchorContext.trim();
      const lineIndex = lines.findIndex((l) => l.trim() === needle);
      if (lineIndex >= 0) {
        const { text: newText } = injectBlockId(text, lineIndex, comment.target, anchorId);
        if (newText !== text) {
          await this.app.vault.modify(docFile, newText);
        }
        restored = true;
      }
    }

    if (restored) {
      comment.status = comment.previousStatus ?? "open";
      delete comment.previousStatus;
      delete comment.anchorContext;
      delete comment.note;
    } else {
      comment.status = "stale";
      comment.note = "anchor context not found on restore";
      delete comment.previousStatus;
    }
    await this.writeSidecar(docPath, sidecar);
  }

  async markStaleAnchors(docPath: string): Promise<number> {
    const sidecar = await this.readSidecar(docPath);
    if (!sidecar) return 0;

    const docFile = this.app.vault.getAbstractFileByPath(docPath);
    if (!(docFile instanceof TFile)) return 0;
    const text = await this.app.vault.read(docFile);

    let changed = 0;
    for (const c of sidecar.comments) {
      if (c.status !== "open") continue;
      const idMatch = c.anchor.replace(/^\^/, "");
      if (!text.includes(`^${idMatch}`)) {
        c.status = "stale";
        c.note = "anchor not found in source";
        changed++;
      }
    }
    if (changed > 0) await this.writeSidecar(docPath, sidecar);
    return changed;
  }
}
