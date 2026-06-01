import { describe, it, expect } from "vitest";
import { blockLineRange } from "./block-range";

const split = (s: string): string[] => s.split("\n");

describe("blockLineRange", () => {
  describe("heading / list-item / image", () => {
    it("returns the single anchor line for heading", () => {
      const lines = split("# Heading ^abc123\n");
      expect(blockLineRange(lines, 0, "heading")).toEqual([0, 0]);
    });

    it("returns the single anchor line for list-item", () => {
      const lines = split("- item ^abc123\n");
      expect(blockLineRange(lines, 0, "list-item")).toEqual([0, 0]);
    });

    it("returns the single anchor line for image", () => {
      const lines = split("![[image.png]] ^abc123\n");
      expect(blockLineRange(lines, 0, "image")).toEqual([0, 0]);
    });
  });

  describe("paragraph", () => {
    it("walks back to start of doc when no blank line separates the paragraph", () => {
      const lines = split("para line 1\npara line 2 ^abc123\n");
      expect(blockLineRange(lines, 1, "paragraph")).toEqual([0, 1]);
    });

    it("walks back only to the line after the previous blank", () => {
      const lines = split("intro\n\npara line 1\npara line 2 ^abc123\n\nnext para\n");
      expect(blockLineRange(lines, 3, "paragraph")).toEqual([2, 3]);
    });

    it("returns the same line when the paragraph is a single line", () => {
      const lines = split("intro\n\nsingle line ^abc123\n");
      expect(blockLineRange(lines, 2, "paragraph")).toEqual([2, 2]);
    });
  });

  describe("code-block", () => {
    it("covers fenced block + anchor line", () => {
      const lines = split("```js\nconsole.log(1)\n```\n^abc123\n");
      expect(blockLineRange(lines, 3, "code-block")).toEqual([0, 3]);
    });

    it("covers indented fenced block + anchor line", () => {
      const lines = split("  ```js\n  let x = 1\n  ```\n^abc123\n");
      expect(blockLineRange(lines, 3, "code-block")).toEqual([0, 3]);
    });

    it("falls back to anchor line when no closing fence is found", () => {
      const lines = split("not a fence\nstill not\n^abc123\n");
      expect(blockLineRange(lines, 2, "code-block")).toEqual([2, 2]);
    });
  });

  describe("table", () => {
    it("covers table rows + blank + anchor line", () => {
      const lines = split("| a | b |\n|---|---|\n| 1 | 2 |\n\n^abc123\n");
      expect(blockLineRange(lines, 4, "table")).toEqual([0, 4]);
    });

    it("covers table rows even with no blank line before the anchor", () => {
      const lines = split("| a | b |\n|---|---|\n| 1 | 2 |\n^abc123\n");
      expect(blockLineRange(lines, 3, "table")).toEqual([0, 3]);
    });

    it("stops walking back when a non-pipe line appears", () => {
      const lines = split("intro\n| a | b |\n|---|---|\n| 1 | 2 |\n\n^abc123\n");
      expect(blockLineRange(lines, 5, "table")).toEqual([1, 5]);
    });
  });

  describe("callout", () => {
    it("covers all contiguous > lines around the anchor", () => {
      const lines = split("> [!note]\n> a line\n> ^abc123\n> more\n\nafter\n");
      expect(blockLineRange(lines, 2, "callout")).toEqual([0, 3]);
    });

    it("returns just the anchor line when callout is one line", () => {
      const lines = split("> [!note] single ^abc123\n\nafter\n");
      expect(blockLineRange(lines, 0, "callout")).toEqual([0, 0]);
    });

    it("stops at the first non-> line", () => {
      const lines = split("intro\n> first\n> ^abc123\n> last\nafter\n");
      expect(blockLineRange(lines, 2, "callout")).toEqual([1, 3]);
    });
  });
});
