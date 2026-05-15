import { describe, it, expect } from "vitest";
import { generateBlockId, injectBlockId, findExistingBlockId } from "./block-id";

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
});
