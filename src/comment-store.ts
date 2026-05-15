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
} from "./block-id";

const SIDECAR_SUFFIX = ".review.md";

export class CommentStore {
  constructor(private app: App) {}

  sidecarPathFor(docPath: string): string {
    return normalizePath(docPath + SIDECAR_SUFFIX);
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
    const nextId = `c${sidecar.comments.length + 1}`;
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
}
