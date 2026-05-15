# Inline Review

Add PR-style review comments to any document in your Obsidian vault. Anchor comments to specific paragraphs, headings, list items, images, code blocks, callouts, or tables — your source documents stay clean because comments live in a sibling `.review.md` sidecar file.

## Why

Obsidian is great for writing long documents collaboratively (with yourself, your future self, or external tools), but it has no built-in equivalent to a GitHub pull-request review. This plugin adds that workflow:

1. Read a document.
2. Drop comments where something needs to change.
3. Hand the document plus its `.review.md` sidecar to any tool — a human, a script, an AI assistant — that can act on the comments.
4. The tool resolves each comment by editing the source doc and flipping the comment status in the sidecar.

The plugin is intentionally protocol-based: it stores comments in a documented [markdown sidecar format](docs/format-spec.md) and does not bind to any specific downstream tool. Anything that can read markdown can participate.

## Features

- **Right-click → Add review comment** on any paragraph, heading, list item, image, code block, callout, or table.
- **Block-reference anchoring**: comments are pinned to Obsidian's native `^blockref` markers, so they survive document reflow.
- **Gutter markers** in the editor: amber for `open`, gray for `resolved`, red for `stale` (the anchored block no longer exists).
- **Review sidebar** listing all comments for the active document, with filters (all / open / resolved / stale), jump-to-anchor, toggle status, and delete.
- **Jump to next open comment** — keyboard-friendly navigation through unresolved items.
- **Stale anchor detection** runs when you reopen a document — if you've edited away an anchored block, the related comment is automatically flagged.
- **Per-document or central-folder sidecar storage** (settings).

## Installation

### From the Obsidian community catalog (once published)

Settings → Community plugins → Browse → search "Inline Review" → Install → Enable.

### Manual install

1. Build (or download a release):
   ```bash
   git clone <this-repo>
   cd obsidian-review
   npm install
   npm run build
   ```
2. Copy `manifest.json`, `main.js`, and `styles.css` to `<vault>/.obsidian/plugins/obsidian-review/`.
3. Reload Obsidian → Settings → Community plugins → enable "Inline Review".

## Usage

### Add a comment

1. Place your cursor on a paragraph (or select within it), or click an image/code-block/heading/etc.
2. Open the command palette (`Cmd/Ctrl + P`) → **Review: Add comment at cursor**.
3. Type your comment, save.

The plugin will:
- Inject a `^blockref` anchor on the target block if it doesn't have one (reusing an existing anchor when present).
- Create (or update) `<doc>.review.md` next to your document.
- Show an amber gutter dot next to the anchored line and a card in the sidebar.

### Open the review sidebar

Click the speech-bubble ribbon icon on the left, or run **Review: Toggle sidebar**.

### Resolve a comment

In the sidebar, click **Resolve** on the comment card. The status flips to `resolved` and the gutter dot turns gray. Click **Reopen** to flip it back.

### Hand off to a downstream tool

The `<doc>.review.md` sidecar is a plain, documented markdown file. Any tool you trust to edit your documents — a script, an AI assistant, a coworker — can read the open comments and apply the requested changes. See the [format spec](docs/format-spec.md) for the exact contract.

## Settings

- **Sidecar location** — alongside the source doc (default) or in a central `_reviews/` folder.
- **Central folder name** — vault-relative folder used when central layout is selected.

## Commands

| Command | What it does |
|---|---|
| Review: Add comment at cursor | Create a new comment anchored to the current block. |
| Review: Toggle sidebar | Show/hide the review sidebar on the right. |
| Review: Jump to next open comment | Move the cursor to the next unresolved comment in the active doc. |

## Sidecar format

See [docs/format-spec.md](docs/format-spec.md) for the full file format contract, including the three comment statuses (`open` / `resolved` / `stale`), the seven anchor target types, and rules for parsers.

## Development

```bash
npm install
npm run dev       # watch mode
npm run build     # production build
npm test          # vitest unit tests for parser + block-id logic
```

Tests cover the sidecar parser/serializer round-trip and the block-id injection logic. UI components are verified manually inside Obsidian.

## License

MIT — see [LICENSE](LICENSE).
