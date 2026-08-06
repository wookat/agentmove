import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { claudeDesktop } from "../src/adapters/claude-desktop.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "claude-desktop-home");

describe("claude-desktop adapter", () => {
  it("exports mcpServers from any candidate config location", async () => {
    const { bundle, warnings } = await claudeDesktop.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ API_TOKEN: "test-not-a-real-token" });
    expect(byName.search!.command).toBe("uvx");
    expect(warnings.some((w) => w.includes("only MCP servers migrate"))).toBe(true);
  });

  it("finds the macOS config location too", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cd-"));
    const dir = path.join(home, "Library/Application Support/Claude");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "claude_desktop_config.json"),
      JSON.stringify({ mcpServers: { one: { command: "x" } } }),
    );
    expect(await claudeDesktop.detect(home)).toBe(true);
    const { bundle } = await claudeDesktop.exportBundle(home);
    expect(bundle.mcpServers.map((s) => s.name)).toEqual(["one"]);
  });

  it("imports with merge into the existing config file and warns for unsupported layers", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "api", transport: "sse", url: "https://sse.example.com" },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await claudeDesktop.planImport(bundle, HOME, {});
    expect(files).toHaveLength(1);
    const config = JSON.parse(files[0]!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(files[0]!.path).toBe(".config/Claude/claude_desktop_config.json");
    expect(config.mcpServers.filesystem).toBeDefined(); // merge keeps existing
    expect(config.mcpServers.docs!.command).toBe("npx");
    expect(config.mcpServers.api!.url).toBe("https://sse.example.com");
    expect(config.mcpServers.off!.enabled).toBeUndefined();
    for (const layer of ["instructions", "persona", "memory", "skills"]) {
      expect(warnings.some((w) => w.startsWith(`${layer}:`)), layer).toBe(true);
    }
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("remote server"))).toBe(true);
  });
});
