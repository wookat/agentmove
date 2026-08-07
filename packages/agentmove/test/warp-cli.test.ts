import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { warpCli } from "../src/adapters/warp-cli.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "warp-cli-home");
const PROJECT = path.join(FIXTURES, "muse-project");

interface McpConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("warp-cli adapter", () => {
  it("exports MCP servers, global rules, and shared skills", async () => {
    const { bundle } = await warpCli.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.cwd).toBe("/tmp");
    expect(byName["api-server"]!.url).toBe("https://example.com/mcp");
    expect(bundle.instructions).toContain("Prefer small, focused diffs");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
  });

  it("imports with merge into ~/.warp_cli/.mcp.json and shared AGENTS.md/skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/srv" },
      { name: "events", transport: "sse", url: "https://e.example.com/sse", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await warpCli.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".warp_cli/.mcp.json")!.content,
    ) as McpConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
    ]);
    expect(config.mcpServers!.docs).toEqual({
      command: "npx",
      args: ["docs-mcp"],
      working_directory: "/srv",
    });
    expect(config.mcpServers!.events).toEqual({ url: "https://e.example.com/sse" });
    const agents = files.find((f) => f.path === ".agents/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(warnings.some((w) => w.includes("disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("shared cross-agent location"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope: exports AGENTS.md + .agents/skills, plans no MCP", async () => {
    const adapter = getProjectAdapter("warp-cli");
    const { bundle, warnings } = await adapter.exportProject(PROJECT);
    expect(bundle.instructions).toContain("Always write tests first");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(warnings.some((w) => w.startsWith("mcp:"))).toBe(true);

    const imp = emptyBundle();
    imp.instructions = "Follow the checklist.";
    imp.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    imp.skills = [{ name: "review", files: { "SKILL.md": "# Review" } }];
    const { files, warnings: iw } = await adapter.planImport(imp, "/nonexistent-project", {});
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/review/SKILL.md")).toBe(true);
    expect(files.some((f) => f.path.includes(".mcp.json"))).toBe(false);
    expect(iw.some((w) => w.startsWith("mcp:"))).toBe(true);
  });
});
