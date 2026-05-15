import { Plugin } from "obsidian";

export default class ReviewPlugin extends Plugin {
  async onload() {
    console.log("obsidian-review: loaded");
  }

  async onunload() {
    console.log("obsidian-review: unloaded");
  }
}
