import { describe, it, expect } from "vitest";
import {
  generateBlockId,
  injectBlockId,
  findExistingBlockId,
  findAllBlockIds,
} from "./block-id";

describe("generateBlockId", () => {
  it("generates a 6-char lowercase alphanumeric id", () => {
    const id = generateBlockId(new Set());
    expect(id).toMatch(/^[a-z0-9]{6}$/);
  });

  it("avoids collisions with existing ids", () => {
    const existing = new Set(["a3f9b1"]);
    for (let i = 0; i < 100; i++) {
      const id = generateBlockId(existing);
      expect(existing.has(id)).toBe(false);
    }
  });
});

describe("findExistingBlockId", () => {
  it("returns the id if a line already has one", () => {
    const result = findExistingBlockId("This is a paragraph. ^abc123");
    expect(result).toBe("abc123");
  });

  it("returns null if the line has no id", () => {
    expect(findExistingBlockId("This is a paragraph.")).toBeNull();
  });
});

describe("findAllBlockIds", () => {
  it("finds standalone 6-char ids", () => {
    const doc = "Para. ^abc123\n\n^def456\n";
    const ids = findAllBlockIds(doc);
    expect(ids.has("abc123")).toBe(true);
    expect(ids.has("def456")).toBe(true);
  });

  it("does not match 6-char prefixes inside longer alphanumeric runs", () => {
    // `^a3f9b1xyz` should NOT be picked up as the id `a3f9b1`
    // (the trailing `xyz` means it's not a real block id).
    const doc = "Something ^a3f9b1xyz else";
    const ids = findAllBlockIds(doc);
    expect(ids.has("a3f9b1")).toBe(false);
    expect(ids.size).toBe(0);
  });

  it("still picks up a valid id followed by whitespace or punctuation", () => {
    const doc = "Para. ^abc123 trailing text";
    const ids = findAllBlockIds(doc);
    expect(ids.has("abc123")).toBe(true);
  });
});

describe("injectBlockId", () => {
  it("appends ^id at end of paragraph line", () => {
    const doc = "First paragraph.\n\nSecond paragraph.";
    const result = injectBlockId(doc, 0, "paragraph", "a3f9b1");
    expect(result.text).toBe("First paragraph. ^a3f9b1\n\nSecond paragraph.");
    expect(result.id).toBe("a3f9b1");
  });

  it("appends ^id to a heading", () => {
    const doc = "## My Section";
    const result = injectBlockId(doc, 0, "heading", "h1h1h1");
    expect(result.text).toBe("## My Section ^h1h1h1");
  });

  it("appends ^id to a list item", () => {
    const doc = "- third bullet";
    const result = injectBlockId(doc, 0, "list-item", "li1li1");
    expect(result.text).toBe("- third bullet ^li1li1");
  });

  it("appends ^id to an image embed", () => {
    const doc = "![[diagram.png]]";
    const result = injectBlockId(doc, 0, "image", "img1im");
    expect(result.text).toBe("![[diagram.png]] ^img1im");
  });

  it("reuses an existing id instead of injecting a new one", () => {
    const doc = "Already anchored paragraph. ^exist1";
    const result = injectBlockId(doc, 0, "paragraph", "newone");
    expect(result.text).toBe(doc);
    expect(result.id).toBe("exist1");
  });

  it("places ^id on its own line after a code block's closing fence", () => {
    const doc = "```ts\nconst x = 1;\n```\n\nMore text.";
    const result = injectBlockId(doc, 0, "code-block", "cb1cb1");
    expect(result.text).toBe(
      "```ts\nconst x = 1;\n```\n^cb1cb1\n\nMore text."
    );
    expect(result.id).toBe("cb1cb1");
  });

  it("reuses an existing id after a code block's closing fence", () => {
    const doc = "```ts\nconst x = 1;\n```\n^cb1cb1\n";
    const result = injectBlockId(doc, 0, "code-block", "newone");
    expect(result.text).toBe(doc);
    expect(result.id).toBe("cb1cb1");
  });

  it("places ^id on a new line after a table", () => {
    const doc = "| col1 | col2 |\n| ---- | ---- |\n| a | b |\nFollowing text.";
    const result = injectBlockId(doc, 0, "table", "tb1tb1");
    expect(result.text).toBe(
      "| col1 | col2 |\n| ---- | ---- |\n| a | b |\n\n^tb1tb1\nFollowing text."
    );
    expect(result.id).toBe("tb1tb1");
  });

  it("places ^id as a new `> ^id` line at the end of a callout", () => {
    const doc = "> [!note] Important\n> Some content here.\n\nAfter.";
    const result = injectBlockId(doc, 0, "callout", "cl1cl1");
    expect(result.text).toBe(
      "> [!note] Important\n> Some content here.\n> ^cl1cl1\n\nAfter."
    );
    expect(result.id).toBe("cl1cl1");
  });

  it("reuses an inline existing id on the last line of a callout", () => {
    const doc = "> [!note] Important\n> Some content here. ^cl1cl1\n\nAfter.";
    const result = injectBlockId(doc, 0, "callout", "newone");
    expect(result.text).toBe(doc);
    expect(result.id).toBe("cl1cl1");
  });
});
