import { App, Modal, Setting } from "obsidian";

export interface CommentBodyModalOptions {
  title?: string;
  initialBody?: string;
  submitLabel?: string;
}

export class AddCommentModal extends Modal {
  private body: string;
  private options: Required<CommentBodyModalOptions>;

  constructor(
    app: App,
    private onSubmit: (body: string) => void,
    options: CommentBodyModalOptions = {}
  ) {
    super(app);
    this.options = {
      title: options.title ?? "Add review comment",
      initialBody: options.initialBody ?? "",
      submitLabel: options.submitLabel ?? "Save",
    };
    this.body = this.options.initialBody;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.options.title });

    new Setting(contentEl).setName("Comment").addTextArea((ta) => {
      ta.setPlaceholder("Your comment... (Cmd/Ctrl+Enter to save)");
      ta.inputEl.rows = 6;
      ta.inputEl.style.width = "100%";
      ta.setValue(this.body);
      ta.onChange((v) => (this.body = v));
      ta.inputEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey)) {
          evt.preventDefault();
          this.submit();
        }
      });
      setTimeout(() => {
        ta.inputEl.focus();
        const len = ta.inputEl.value.length;
        ta.inputEl.setSelectionRange(len, len);
      }, 0);
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(this.options.submitLabel)
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }

  private submit() {
    const body = this.body.trim();
    if (body === "") return;
    this.close();
    this.onSubmit(body);
  }

  onClose() {
    this.contentEl.empty();
  }
}
