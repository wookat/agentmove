import { describe, expect, it } from "vitest";
import { fromMif, toMif } from "../src/mif.js";
import { CliError, MemoryEntry } from "../src/model.js";

const entries: MemoryEntry[] = [
  { content: "Prefers pnpm.", source: "MEMORY.md", kind: "long-term" },
  { content: "Did a thing.", source: "memory/2026-08-01.md", kind: "daily", date: "2026-08-01" },
];

describe("MIF v2 memory interchange", () => {
  it("round-trips entries through a MIF document", () => {
    const doc = toMif(entries, "2026-08-05T00:00:00Z");
    expect(doc.mif_version).toBe("2.0");
    expect(doc.memories).toHaveLength(2);
    for (const m of doc.memories) {
      expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(m.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    const warnings: string[] = [];
    const back = fromMif("test.mif.json", JSON.stringify(doc), warnings);
    expect(back.map((e) => e.content)).toEqual(entries.map((e) => e.content));
    expect(back[1]!.kind).toBe("daily");
    expect(back[1]!.date).toBe("2026-08-01");
    expect(warnings).toEqual([]);
  });

  it("rejects non-MIF documents with exit-code 3", () => {
    expect(() => fromMif("x.json", '{"foo":1}', [])).toThrowError(CliError);
    try {
      fromMif("x.json", '{"foo":1}', []);
    } catch (e) {
      expect((e as CliError).exitCode).toBe(3);
    }
  });

  it("skips content-less memories and warns about non-portable fields", () => {
    const warnings: string[] = [];
    const back = fromMif(
      "y.mif.json",
      JSON.stringify({
        mif_version: "2.0",
        memories: [
          { id: "1", created_at: "2026-01-01T00:00:00Z" },
          { id: "2", content: "ok", created_at: "2026-01-01T00:00:00Z", embedding: [0.1] },
        ],
      }),
      warnings,
    );
    expect(back).toHaveLength(1);
    expect(warnings.some((w) => w.includes("no string content"))).toBe(true);
    expect(warnings.some((w) => w.includes("embedding"))).toBe(true);
  });
});
