import { App, Modal, Setting } from "obsidian";

export class AddCommentModal extends Modal {
  private body = "";

  constructor(app: App, private onSubmit: (body: string) => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Add review comment" });

    new Setting(contentEl).setName("Comment").addTextArea((ta) => {
      ta.setPlaceholder("Your comment...");
      ta.inputEl.rows = 6;
      ta.inputEl.style.width = "100%";
      ta.onChange((v) => (this.body = v));
      setTimeout(() => ta.inputEl.focus(), 0);
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            if (this.body.trim() === "") return;
            this.close();
            this.onSubmit(this.body.trim());
          })
      )
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
