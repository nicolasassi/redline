# Review Sidecar Format Specification

Version 1.

This document specifies the on-disk format used by the Review plugin. Any tool that produces or consumes review comments — editors, scripts, automation — should follow this contract.

## File location and naming

For each reviewed document `<doc>.md`, a sidecar file is placed next to it:

```
<doc>.md
<doc>.md.review.md
```

The plugin also supports a central-folder layout where every sidecar lives in a single configured folder (default `_reviews/`). In that mode, the sidecar's filename encodes the original path with `/` replaced by `__`, e.g., `_reviews/projects__scheduling.md.review.md`.

The `review_for:` frontmatter field always carries the original document's vault-relative path, so consumers can locate the source even when the sidecar layout varies.

## File structure

```markdown
---
review_for: scheduled-payments.md
format_version: 1
updated: 2026-05-15T10:30:00Z
---

# Review: scheduled-payments.md

> [!review-comment]+ c1 · open
> anchor: ^a3f9b1
> target: paragraph
> created: 2026-05-15T09:14:00Z
>
> This section glosses over what happens when scheduling is cancelled
> before execution. Can you expand on the recovery flow?

> [!review-comment] c2 · resolved
> anchor: ^img-d1a2c8
> target: image
> created: 2026-05-15T09:22:00Z
> resolved: 2026-05-15T10:30:00Z
> resolution: Replaced asset with regenerated diagram showing dashed async arrow.
>
> The arrow from Merlin to Hylian should be dashed — async call.
```

## Frontmatter

| Field | Required | Type | Description |
|---|---|---|---|
| `review_for` | yes | string | Vault-relative path of the source document. |
| `format_version` | yes | integer | Currently `1`. **Parsers MUST reject unknown values.** |
| `updated` | yes | ISO-8601 string | Time of the last write to this sidecar. |

## Comments

Each comment is encoded as an Obsidian callout block starting with `> [!review-comment]` (optionally followed by `+` to indicate the callout is expanded by default in Obsidian).

### Callout title

```
> [!review-comment][+] <id> · <status>
```

- `<id>` is a human-readable label, by convention `cN` where `N` is a sequential integer. Producers SHOULD pick `N = max(existing ids) + 1` to avoid collisions after deletions. The real stable identity of the comment is its anchor.
- `<status>` is one of `open`, `resolved`, `stale` (see below).

### Metadata lines

Inside the callout, before the first blank line, key/value pairs in the form `key: value`, one per line, each prefixed with `> `.

| Key | Required | Used in | Description |
|---|---|---|---|
| `anchor` | yes | all statuses | The Obsidian block reference the comment is pinned to, e.g., `^a3f9b1`. |
| `target` | yes | all statuses | What the anchor points to. One of: `paragraph`, `heading`, `list-item`, `image`, `code-block`, `callout`, `table`. |
| `created` | yes | all statuses | ISO-8601 timestamp of when the comment was first created. |
| `resolved` | when status is `resolved` | resolved | ISO-8601 timestamp of resolution. |
| `resolution` | when status is `resolved` | resolved | Free-text one-line summary of what was changed in response to the comment. |
| `note` | optional | any | Free-text annotation. Used by tools to explain why a comment couldn't be acted on (e.g., `anchor not found in source` for stale comments). |

### Body

After the first blank line (a `>` followed by nothing else), the rest of the callout block is the comment body. Multi-line, markdown. Each line is prefixed with `> ` as required by Obsidian callout syntax.

## Statuses

| Status | Meaning |
|---|---|
| `open` | The comment is waiting to be addressed. |
| `resolved` | The comment has been addressed. A `resolution:` field describes what changed. |
| `stale` | The comment's anchor no longer exists in the source document. The plugin sets this automatically when a document is opened. A consumer SHOULD NOT take action on a stale comment without user intervention. |

## Anchoring rules

Comments are anchored using Obsidian's native block reference syntax: `^[a-z0-9]{6}`, six lowercase alphanumeric characters preceded by a caret. The plugin places anchors on the source document as follows:

| Target | Placement |
|---|---|
| paragraph | End of the paragraph's last line, after a single space: `…final word. ^a3f9b1` |
| heading | End of the heading line: `## My Section ^a3f9b1` |
| list-item | End of the item line: `- third bullet ^a3f9b1` |
| image | Same line as the embed: `![[diagram.png]] ^a3f9b1` |
| code-block | On its own line immediately after the closing fence. |
| callout | On a new `> ^id` line appended after the last content line of the callout. |
| table | On its own blank line immediately after the table. |

Producers MUST scan the document for the existing anchor before injecting a new one — anchors are reused, never duplicated.

## Parsing rules

- A callout is recognised by a line matching `^> \[!review-comment\]\+? \S+ · \S+\s*$`.
- Metadata lines have the shape `^> (\w+):\s*(.*)$`.
- The first `> ` (with no trailing content other than whitespace) ends the metadata section and starts the body.
- The block ends when the next non-`>` line is encountered.
- Parsers MUST reject sidecars whose `format_version` is not `1`.

## Future versions

This spec is versioned. Breaking changes will bump `format_version` and may include, for example:

- Threaded replies (a `replies:` array per comment).
- Character-range anchors (a new `target: text-range` plus `start`/`end` fields).
- Image region annotations.

Consumers that don't recognise a future version MUST refuse to parse it rather than guess.
