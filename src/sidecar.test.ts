import { describe, it, expect } from "vitest";
import { parseSidecar, serializeSidecar } from "./sidecar";

const SAMPLE = `---
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
> resolution: Replaced asset with regenerated PlantUML showing dashed async arrow.
>
> The arrow from Merlin to Hylian should be dashed — async call.
`;

describe("parseSidecar", () => {
  it("parses frontmatter", () => {
    const result = parseSidecar(SAMPLE);
    expect(result.reviewFor).toBe("scheduled-payments.md");
    expect(result.formatVersion).toBe(1);
    expect(result.updated).toBe("2026-05-15T10:30:00Z");
  });

  it("parses two comments with correct statuses", () => {
    const result = parseSidecar(SAMPLE);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].id).toBe("c1");
    expect(result.comments[0].status).toBe("open");
    expect(result.comments[1].id).toBe("c2");
    expect(result.comments[1].status).toBe("resolved");
  });

  it("parses comment metadata", () => {
    const result = parseSidecar(SAMPLE);
    const c1 = result.comments[0];
    expect(c1.anchor).toBe("^a3f9b1");
    expect(c1.target).toBe("paragraph");
    expect(c1.created).toBe("2026-05-15T09:14:00Z");
    expect(c1.resolved).toBeUndefined();
  });

  it("parses comment body across multiple lines", () => {
    const result = parseSidecar(SAMPLE);
    const c1 = result.comments[0];
    expect(c1.body).toBe(
      "This section glosses over what happens when scheduling is cancelled\nbefore execution. Can you expand on the recovery flow?"
    );
  });

  it("captures resolved-only fields when present", () => {
    const result = parseSidecar(SAMPLE);
    const c2 = result.comments[1];
    expect(c2.resolved).toBe("2026-05-15T10:30:00Z");
    expect(c2.resolution).toContain("regenerated PlantUML");
  });
});

describe("serializeSidecar", () => {
  it("round-trips: parse → serialize → parse yields the same data", () => {
    const original = parseSidecar(SAMPLE);
    const serialized = serializeSidecar(original);
    const reparsed = parseSidecar(serialized);
    expect(reparsed).toEqual(original);
  });

  it("emits a callout per comment with the correct title", () => {
    const sidecar = parseSidecar(SAMPLE);
    const text = serializeSidecar(sidecar);
    expect(text).toMatch(/> \[!review-comment\]\+? c1 · open/);
    expect(text).toMatch(/> \[!review-comment\]\+? c2 · resolved/);
  });
});
