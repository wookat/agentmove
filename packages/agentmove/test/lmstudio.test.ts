import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { lmstudio } from "../src/adapters/lmstudio.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "lmstudio-home");

interface LmstudioConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("lmstudio adapter", () => {
  it("exports stdio and remote servers from ~/.lmstudio/mcp.json", async () => {
    const { bundle, warnings } = await lmstudio.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.playwright!.transport).toBe("stdio");
    expect(byName.playwright!.env).toEqual({ PLAYWRIGHT_API_KEY: "test-not-a-real-token" });
    expect(byName["hf-mcp-server"]!.transport).toBe("http"); // plain url entry
    expect(byName["hf-mcp-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(warnings).toEqual([]);
  });

  it("imports by merging; non-MCP layers are skipped with warnings", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await lmstudio.planImport(bundle, HOME, {});
    expect(files).toHaveLength(1);
    const config = JSON.parse(
      files.find((f) => f.path === ".lmstudio/mcp.json")!.content,
    ) as LmstudioConfig;
    expect(Object.keys(config.mcpServers!)).toContain("playwright"); // merge keeps existing
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse written without a transport type"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await lmstudio.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".lmstudio/mcp.json")!.content,
    ) as LmstudioConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const missing = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-lmstudio-"));
    const { bundle, warnings } = await lmstudio.exportBundle(missing);
    expect(bundle.mcpServers).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
