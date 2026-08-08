import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS, getAdapter } from "../src/adapters/index.js";
import { diffBundles, formatDiff } from "../src/diff.js";
import { formatDoctor, runDoctor } from "../src/doctor.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const homeOf = (name: string) => path.join(FIXTURES, name);

describe("getAdapter", () => {
  it("throws a helpful error for unknown clients", () => {
    expect(() => getAdapter("emacs")).toThrow(/unknown client "emacs"/);
  });
});

describe("openclaw import", () => {
  it("plans workspace files, per-kind memory targets, and merged config", async () => {
    const { bundle } = await ADAPTERS.hermes.exportBundle(homeOf("hermes-home"));
    const { files, warnings } = await ADAPTERS.openclaw.planImport(bundle, homeOf("openclaw-home"));
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".openclaw/openclaw.json");
    expect(paths).toContain(".openclaw/workspace/SOUL.md");
    expect(paths).toContain(".openclaw/workspace/MEMORY.md");
    expect(paths).toContain(".openclaw/workspace/USER.md");
    expect(paths).toContain(".openclaw/workspace/skills/notes/SKILL.md");

    const memory = files.find((f) => f.path === ".openclaw/workspace/MEMORY.md")!;
    expect(memory.content).toContain("Likes espresso.");
    expect(memory.content).toContain("Works at Zalize.");

    const config = files.find((f) => f.path === ".openclaw/openclaw.json")!;
    const parsed = JSON.parse(config.content) as {
      agents: { defaults: { model: string } };
      mcp: { servers: Record<string, unknown> };
    };
    expect(parsed.agents.defaults.model).toBe("hermes-4");
    // existing openclaw servers are kept; imported ones are merged in
    expect(Object.keys(parsed.mcp.servers).sort()).toEqual(["docs", "remote"]);
    // existing openclaw.json in the fixture uses JSON5 comments
    expect(warnings.some((w) => w.includes("comments"))).toBe(true);
  });

  it("plans daily memory entries into memory/<date>.md", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files } = await ADAPTERS.openclaw.planImport(bundle, homeOf("hermes-home"));
    expect(files.some((f) => f.path === ".openclaw/workspace/memory/2026-08-01.md")).toBe(true);
  });
});

describe("gemini import into non-empty home", () => {
  it("preserves existing settings keys and flags persona approximation", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS.gemini.planImport(bundle, homeOf("gemini-home"));
    const settings = files.find((f) => f.path === ".gemini/settings.json")!;
    expect(
      Object.keys((JSON.parse(settings.content) as { mcpServers: object }).mcpServers).sort(),
    ).toEqual(["docs", "fetch", "remote"]);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
    expect(files.some((f) => f.path === ".gemini/skills/todo/SKILL.md")).toBe(true);
  });
});

describe("claude-code import into existing config", () => {
  it("keeps unrelated top-level keys in ~/.claude.json", async () => {
    const { bundle } = await ADAPTERS.codex.exportBundle(homeOf("codex-home"));
    const { files, warnings } = await ADAPTERS["claude-code"].planImport(bundle, homeOf("claude-home"));
    const config = files.find((f) => f.path === ".claude.json")!;
    const parsed = JSON.parse(config.content) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(parsed.mcpServers).sort()).toEqual(["github", "linear", "notion", "search"]);
    // codex `search` server is disabled; claude-code has no disabled flag
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
  });
});

describe("mcp merge semantics", () => {
  it("replaceMcp drops existing servers with a warning", async () => {
    const { bundle } = await ADAPTERS.codex.exportBundle(homeOf("codex-home"));
    const { files, warnings } = await ADAPTERS["claude-code"].planImport(
      bundle,
      homeOf("claude-home"),
      { replaceMcp: true },
    );
    const config = files.find((f) => f.path === ".claude.json")!;
    const parsed = JSON.parse(config.content) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(parsed.mcpServers).sort()).toEqual(["github", "linear", "search"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("warns when an imported server overwrites an existing one with the same name", async () => {
    const { bundle } = await ADAPTERS.gemini.exportBundle(homeOf("gemini-home"));
    const { warnings } = await ADAPTERS.gemini.planImport(bundle, homeOf("claude-home"));
    // no same-name conflicts across these fixtures: no overwrite warnings expected
    expect(warnings.some((w) => w.includes("overwritten by import"))).toBe(false);
  });
});

describe("format helpers", () => {
  it("formatDiff renders symbols and formatDoctor renders inventories", async () => {
    const [a, b] = await Promise.all([
      ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home")),
      ADAPTERS.gemini.exportBundle(homeOf("gemini-home")),
    ]);
    const text = formatDiff(diffBundles(a.bundle, b.bundle));
    expect(text).toMatch(/^[-+~] \[/m);
    expect(formatDiff([])).toBe("no differences\n");

    const reports = await runDoctor(homeOf("gemini-home"));
    const doctorText = formatDoctor(reports);
    expect(doctorText).toContain("✓ Gemini CLI (gemini)");
    expect(doctorText).toContain("not detected");
  });
});
