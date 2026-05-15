import { Plugin } from "obsidian";
import { CommentStore } from "./comment-store";
import { registerAddCommentCommand } from "./commands";

export default class ReviewPlugin extends Plugin {
  store!: CommentStore;

  async onload() {
    this.store = new CommentStore(this.app);
    registerAddCommentCommand(this.app, this.store, (cmd) => this.addCommand(cmd));
    console.log("obsidian-review: loaded");
  }

  async onunload() {
    console.log("obsidian-review: unloaded");
  }
}
