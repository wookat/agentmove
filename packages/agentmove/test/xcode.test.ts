import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { ADAPTERS } from "../src/adapters/index.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const homeOf = (name: string) => path.join(FIXTURES, name);
const BASE = "Library/Developer/Xcode/CodingAssistant";

describe("xcode-claude", () => {
  it("exports mcp + instructions + skills from the ClaudeAgentConfig root", async () => {
    const { bundle } = await ADAPTERS["xcode-claude"].exportBundle(homeOf("xcode-claude-home"));
    expect(bundle.mcpServers.map((s) => s.name).sort()).toEqual(["notion", "xcode"]);
    expect(bundle.mcpServers.find((s) => s.name === "xcode")?.command).toBe("xcrun");
    expect(bundle.instructions).toContain("Swift concurrency");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("plans writes under the Xcode root, merging existing servers", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS["xcode-claude"].planImport(
      bundle,
      homeOf("xcode-claude-home"),
    );
    const config = files.find((f) => f.path === `${BASE}/ClaudeAgentConfig/.claude.json`)!;
    const parsed = JSON.parse(config.content) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(parsed.mcpServers).sort()).toEqual(["docs", "notion", "remote", "xcode"]);
    const md = files.find((f) => f.path === `${BASE}/ClaudeAgentConfig/.claude/CLAUDE.md`)!;
    expect(md.content).toContain("persona (SOUL.md)");
    expect(files.some((f) => f.path.startsWith(`${BASE}/ClaudeAgentConfig/.claude/skills/`))).toBe(true);
    expect(files.every((f) => f.path.startsWith(BASE))).toBe(true);
    expect(warnings.some((w) => w.includes("xcode-claude"))).toBe(true);
  });
});

describe("xcode-codex", () => {
  it("exports TOML mcp servers and AGENTS.md from the codex root", async () => {
    const { bundle } = await ADAPTERS["xcode-codex"].exportBundle(homeOf("xcode-codex-home"));
    expect(bundle.config.model).toBe("gpt-5.2-codex");
    expect(bundle.mcpServers.map((s) => s.name).sort()).toEqual(["search", "xcode"]);
    expect(bundle.mcpServers.find((s) => s.name === "search")?.headers?.["X-Api-Key"]).toBe(
      "test-not-a-real-token",
    );
    expect(bundle.instructions).toContain("Swift concurrency");
    expect(bundle.skills).toEqual([]);
  });

  it("plans config.toml/AGENTS.md under the codex root and skips skills with a warning", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS["xcode-codex"].planImport(
      bundle,
      homeOf("xcode-codex-home"),
    );
    const config = files.find((f) => f.path === `${BASE}/codex/config.toml`)!;
    const parsed = parseToml(config.content) as { mcp_servers: Record<string, unknown> };
    expect(Object.keys(parsed.mcp_servers).sort()).toEqual(["docs", "remote", "search", "xcode"]);
    expect(files.some((f) => f.path === `${BASE}/codex/AGENTS.md`)).toBe(true);
    expect(files.every((f) => f.path.startsWith(BASE))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills: xcode-codex"))).toBe(true);
  });
});

describe("xcode-gemini", () => {
  it("exports settings.json mcp servers and splits Gemini Added Memories", async () => {
    const { bundle } = await ADAPTERS["xcode-gemini"].exportBundle(homeOf("xcode-gemini-home"));
    expect(bundle.mcpServers.map((s) => s.name).sort()).toEqual(["fetch", "xcode"]);
    expect(bundle.instructions).toContain("Swift concurrency");
    expect(bundle.instructions).not.toContain("Added Memories");
    expect(bundle.memory.map((m) => m.content)).toEqual(["Project targets iOS 26."]);
  });

  it("plans settings.json/GEMINI.md under the gemini root", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS["xcode-gemini"].planImport(
      bundle,
      homeOf("xcode-gemini-home"),
    );
    const settings = files.find((f) => f.path === `${BASE}/gemini/settings.json`)!;
    const parsed = JSON.parse(settings.content) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(parsed.mcpServers).sort()).toEqual(["docs", "fetch", "remote", "xcode"]);
    const md = files.find((f) => f.path === `${BASE}/gemini/GEMINI.md`)!;
    expect(md.content).toContain("## Gemini Added Memories");
    expect(files.every((f) => f.path.startsWith(BASE))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills: xcode-gemini"))).toBe(true);
  });
});
