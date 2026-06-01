# Redline manual test plan

Run this end-to-end in Obsidian after installing the plugin build. The plan
covers every shipped issue (#1–#7) plus regression checks aimed at the
features each fix touches.

## Setup

1. Build the plugin: `npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<vault>/.obsidian/plugins/redline/`.
3. Enable **Redline** in *Settings → Community plugins*.
4. Open the Redline sidebar via ribbon or command **Redline: Toggle sidebar**.
5. Create a scratch folder with at least:
   - `notes/A.md` — has a heading, paragraph, list, image link, code block,
     table, and a callout (one anchor target per type).
   - `notes/B.md` — second doc to exercise cross-doc behaviour.

Use a fresh vault if possible so you can clean up by deleting the folder.

---

## #2 — Cmd-Enter saves the Add Comment modal

1. In `A.md`, place the cursor on a paragraph. Run **Redline: Add comment**.
2. Type a body. Press **Cmd-Enter** (macOS) or **Ctrl-Enter** (Win/Linux).
3. ✅ Modal closes, sidecar gets the new comment, sidebar shows the card.
4. ✅ Pressing **Esc** with text typed cancels the modal without saving.

Regression checks
- ✅ Clicking the **Submit** button still works.
- ✅ Reopen the modal in edit mode (sidebar → Edit) and confirm Cmd-Enter
  updates the body.

---

## #3 — Edit an existing comment

1. Sidebar → pick an open comment → click **Edit**.
2. Change the body, press Cmd-Enter.
3. ✅ Card body updates and sidecar reflects the new text + bumped
   `updated` timestamp.
4. ✅ Editing with no changes is a no-op (no spurious sidecar write).
5. ✅ Editing also lets you set/clear the due date (covered in #6).

---

## #4 — Markdown rendering in cards and hover

1. Add a comment whose body contains: `**bold**`, `*italic*`, a code span,
   a `[link](https://example.com)`, a list, and an inline image.
2. ✅ Sidebar card renders the markdown (no raw asterisks).
3. ✅ Hover over the anchored block in the editor — tooltip renders the
   same markdown.
4. ✅ The sidecar file (open it directly) still shows raw markdown
   inside the `> [!review-comment]` callout.

Regression checks
- ✅ Empty body shows the placeholder `(no body)`.
- ✅ Long bodies don't blow up the card layout.

---

## #1 — Source-doc rename / move / delete mirrors the sidecar

(Setting *Mirror source-doc rename/delete on sidecar* is on by default.)

1. Rename `A.md` to `A-renamed.md` (right-click → Rename).
   - ✅ `A.md.review.md` becomes `A-renamed.md.review.md`.
   - ✅ The sidecar's frontmatter `reviewFor:` updates to the new path.
   - ✅ The sidebar still shows the comments after renaming.
2. Move `A-renamed.md` into a subfolder.
   - ✅ Sidecar moves alongside it.
3. Delete `A-renamed.md` (send to trash).
   - ✅ Sidecar is trashed too.
4. Toggle the setting off, repeat (1).
   - ✅ Sidecar is left in place.

Regression checks
- ✅ Renaming the sidecar manually does NOT trigger a recursive rename.
- ✅ Renaming an unrelated file (no sidecar) is a no-op.
- ✅ Central-folder mode (Settings → Sidecar location → Central) also
  mirrors renames using the path-encoded filename.

---

## #5 — Reattach stale comments via saved anchor context

1. In `A.md`, add a comment to a distinctive paragraph (e.g. text
   "this is the canary sentence").
2. Open the source doc and **delete** the `^anchor-id` token at the end
   of that paragraph (leave the paragraph text intact).
3. Focus another doc, then return to `A.md` (triggers `markStaleAnchors`).
   - ✅ The comment status flips to **stale** in the sidebar.
4. In the sidebar, click **Reattach** on the stale comment.
   - ✅ Notice "Reattached <id>" appears.
   - ✅ The status flips back to **open**.
   - ✅ The paragraph has a fresh anchor id appended.
5. Repeat (1)-(3), then **modify** the paragraph text so the anchor
   context can no longer be found.
   - ✅ **Reattach** shows "Could not find anchor context for <id>".

Regression checks
- ✅ Restoring an archived comment (rendered "Bring back" button in the
  sidecar) still works the same way.
- ✅ Existing comments created before this version (no `anchorContext`)
  do not break — the **Reattach** button only appears when context exists.

---

## #6 — Per-comment review-by date with overdue indicator

1. Add a new comment. In the modal, set **Due date** to *yesterday*.
   - ✅ Card shows "Due YYYY-MM-DD · overdue" in red.
   - ✅ Card has a red left border.
   - ✅ Gutter dot is red.
   - ✅ Sidebar header includes "1 overdue".
   - ✅ Hover tooltip shows the overdue line.
2. Add another comment with **Due** = *tomorrow*.
   - ✅ Due shown in normal (muted) text, no overdue styling.
3. Add a comment with **no due date**.
   - ✅ No due line, no overdue styling.
4. Resolve the overdue comment.
   - ✅ Overdue count drops; resolved comments are never counted as overdue.
5. Filter the sidebar by **overdue**.
   - ✅ Only currently overdue, open comments are visible.
6. Edit a comment, clear the due date (delete the value in the modal).
   - ✅ Sidecar drops the `> due:` line.
7. Open the raw sidecar file — confirm the metadata uses the
   `> due: YYYY-MM-DD` format inside the callout.

Regression checks
- ✅ Filters **all / open / resolved / stale** still work.
- ✅ Stale comments are never marked overdue (overdue requires status=open).
- ✅ Sidecars written by an older version still load (no `due` field).

---

## #7 — Cross-doc review dashboard

1. Make sure both `A.md` and `B.md` have at least one comment each, with a
   mix of open / resolved / stale / overdue states.
2. Run **Redline: Open dashboard** (or click the layout-dashboard ribbon).
   - ✅ A new tab opens titled "Redline dashboard".
   - ✅ Header shows totals "N docs · X open · Y overdue · Z stale".
   - ✅ Table lists both `A.md` and `B.md` rows.
3. Click a column header to sort (e.g. **Overdue**).
   - ✅ Sort indicator (▲/▼) flips between clicks.
   - ✅ Rows reorder accordingly.
4. Click a row.
   - ✅ Source doc opens in a markdown view, focused.
5. While the dashboard is open, add a new comment in `A.md`.
   - ✅ Dashboard re-renders, counts update.
6. Delete `B.md.review.md` directly.
   - ✅ Row disappears from the dashboard.
7. Run the **Open dashboard** command again while it is already open.
   - ✅ It focuses the existing tab instead of creating a duplicate.

Regression checks
- ✅ Vaults with **zero** review sidecars show "No review sidecars found".
- ✅ Central-folder mode (Settings) — dashboard still resolves source
  paths correctly (via `__` → `/` decoding).
- ✅ Archived comments are not counted in any column.

---

## Cross-cutting regression sweep

Run these after the focused checks pass.

- ✅ Add, resolve, reopen, archive, restore, delete — full lifecycle of a
  comment still works.
- ✅ "Jump to next open comment" command jumps in document order.
- ✅ Gutter dots show in editor mode, colours match status
  (open=yellow, resolved=grey, stale=red, overdue=red).
- ✅ Hover tooltip appears anywhere in the anchored block (paragraph
  walks back to a blank line; code blocks / tables / callouts span the
  whole block).
- ✅ Closing and reopening the vault preserves everything (sidecars are
  the source of truth).
- ✅ Disabling the plugin removes the sidebar/dashboard leaves cleanly;
  re-enabling restores them.

If any line above fails, file a regression issue referencing the section
header and paste the steps that triggered it.
