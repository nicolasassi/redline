import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import { CommentStore, SIDECAR_SUFFIX } from "../comment-store";
import { todayIso } from "../due-date";
import { buildRow, DocRow } from "./dashboard-row";

export const REVIEW_DASHBOARD_VIEW_TYPE = "redline-dashboard";

type SortKey = "doc" | "open" | "stale" | "overdue" | "oldest" | "earliest";
type SortDir = "asc" | "desc";

export class ReviewDashboard extends ItemView {
  private sortKey: SortKey = "overdue";
  private sortDir: SortDir = "desc";
  private renderGen = 0;

  constructor(leaf: WorkspaceLeaf, private store: CommentStore) {
    super(leaf);
  }

  getViewType() {
    return REVIEW_DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "Redline dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }

  async onOpen() {
    const refreshIfReview = (file: { path: string }) => {
      if (file.path.endsWith(SIDECAR_SUFFIX)) this.render();
    };
    this.registerEvent(this.app.vault.on("modify", refreshIfReview));
    this.registerEvent(this.app.vault.on("create", refreshIfReview));
    this.registerEvent(this.app.vault.on("delete", refreshIfReview));
    this.registerEvent(this.app.vault.on("rename", refreshIfReview));
    await this.render();
  }

  async render() {
    const gen = ++this.renderGen;
    const rows = await this.collectRows();
    if (gen !== this.renderGen) return;

    const root = this.contentEl;
    root.empty();
    root.addClass("review-dashboard");

    const header = root.createDiv({ cls: "review-dashboard-header" });
    const totals = rows.reduce(
      (acc, r) => {
        acc.open += r.open;
        acc.overdue += r.overdue;
        acc.stale += r.stale;
        return acc;
      },
      { open: 0, overdue: 0, stale: 0 }
    );
    header.createEl("h4", {
      text:
        `Redline dashboard · ${rows.length} docs · ` +
        `${totals.open} open · ${totals.overdue} overdue · ${totals.stale} stale`,
    });

    if (rows.length === 0) {
      root.createEl("p", { text: "No review sidecars found in this vault." });
      return;
    }

    const sorted = this.sortRows(rows);

    const table = root.createEl("table", { cls: "review-dashboard-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    const cols: Array<{ key: SortKey; label: string }> = [
      { key: "doc", label: "Document" },
      { key: "open", label: "Open" },
      { key: "stale", label: "Stale" },
      { key: "overdue", label: "Overdue" },
      { key: "oldest", label: "Oldest open" },
      { key: "earliest", label: "Earliest due" },
    ];
    for (const col of cols) {
      const th = headRow.createEl("th", { text: col.label });
      th.addClass("review-dashboard-th");
      if (this.sortKey === col.key) {
        th.addClass(`review-dashboard-th-sort-${this.sortDir}`);
        th.setText(`${col.label} ${this.sortDir === "asc" ? "▲" : "▼"}`);
      }
      th.onclick = () => {
        if (this.sortKey === col.key) {
          this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        } else {
          this.sortKey = col.key;
          this.sortDir = col.key === "doc" ? "asc" : "desc";
        }
        this.render();
      };
    }

    const tbody = table.createEl("tbody");
    for (const row of sorted) {
      const tr = tbody.createEl("tr", { cls: "review-dashboard-row" });
      const docCell = tr.createEl("td", { cls: "review-dashboard-doc" });
      docCell.setText(row.sourcePath);
      tr.createEl("td", { text: String(row.open) });
      tr.createEl("td", { text: String(row.stale) });
      const overdueCell = tr.createEl("td", { text: String(row.overdue) });
      if (row.overdue > 0) overdueCell.addClass("review-dashboard-overdue");
      tr.createEl("td", { text: row.oldestOpen ? row.oldestOpen.slice(0, 10) : "—" });
      tr.createEl("td", { text: row.earliestDue ?? "—" });
      tr.onclick = () => this.openSource(row.sourcePath);
    }
  }

  private async collectRows(): Promise<DocRow[]> {
    const today = todayIso();
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.endsWith(SIDECAR_SUFFIX));
    const rows: DocRow[] = [];
    for (const file of files) {
      const sourcePath = this.store.sourcePathFor(file.path);
      if (!sourcePath) continue;
      const sidecar = await this.store.readSidecar(sourcePath);
      if (!sidecar) continue;
      rows.push(buildRow(sourcePath, sidecar.comments, today));
    }
    return rows;
  }

  private sortRows(rows: DocRow[]): DocRow[] {
    const dir = this.sortDir === "asc" ? 1 : -1;
    const key = this.sortKey;
    return rows.slice().sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (av === bv) return a.sourcePath.localeCompare(b.sourcePath);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av < bv ? -1 * dir : 1 * dir;
    });
  }

  private async openSource(sourcePath: string) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;
    const leaf =
      this.app.workspace
        .getLeavesOfType("markdown")
        .find((l) => (l.view as MarkdownView).file?.path === sourcePath) ??
      this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
}

function sortValue(row: DocRow, key: SortKey): string | number | null {
  switch (key) {
    case "doc":
      return row.sourcePath;
    case "open":
      return row.open;
    case "stale":
      return row.stale;
    case "overdue":
      return row.overdue;
    case "oldest":
      return row.oldestOpen;
    case "earliest":
      return row.earliestDue;
  }
}
