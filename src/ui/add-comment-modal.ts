import { App, Modal, Setting } from "obsidian";
import { isValidDueDate } from "../due-date";

export interface CommentBodyModalOptions {
  title?: string;
  initialBody?: string;
  initialDue?: string;
  submitLabel?: string;
}

export interface CommentBodyModalResult {
  body: string;
  due?: string;
}

export class AddCommentModal extends Modal {
  private body: string;
  private due: string;
  private options: Required<Omit<CommentBodyModalOptions, "initialDue">> & {
    initialDue: string;
  };

  constructor(
    app: App,
    private onSubmit: (result: CommentBodyModalResult) => void,
    options: CommentBodyModalOptions = {}
  ) {
    super(app);
    this.options = {
      title: options.title ?? "Add review comment",
      initialBody: options.initialBody ?? "",
      initialDue: options.initialDue ?? "",
      submitLabel: options.submitLabel ?? "Save",
    };
    this.body = this.options.initialBody;
    this.due = this.options.initialDue;
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
      .setName("Due date")
      .setDesc("Optional. Cards past this date are highlighted as overdue.")
      .addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.due);
        text.onChange((v) => (this.due = v));
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
    const due = this.due.trim();
    this.close();
    this.onSubmit({ body, due: isValidDueDate(due) ? due : undefined });
  }

  onClose() {
    this.contentEl.empty();
  }
}
