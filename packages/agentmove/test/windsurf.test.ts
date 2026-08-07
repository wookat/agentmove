import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "../src/adapters/index.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const home = path.join(FIXTURES, "windsurf-home");

describe("windsurf adapter", () => {
  it("exports mcp_config.json (serverUrl normalized to url) and global rules", async () => {
    const { bundle } = await ADAPTERS.windsurf.exportBundle(home);
    expect(bundle.mcpServers.map((s) => s.name).sort()).toEqual(["files", "remote"]);
    const remote = bundle.mcpServers.find((s) => s.name === "remote")!;
    expect(remote.transport).toBe("http");
    expect(remote.url).toBe("https://mcp.example.com/mcp");
    expect(bundle.instructions).toContain("Always use TypeScript.");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
  });

  it("plans imports with serverUrl for remote servers and merge semantics", async () => {
    const { bundle } = await ADAPTERS.windsurf.exportBundle(home);
    const { files } = await ADAPTERS.windsurf.planImport(bundle, home);
    const mcp = JSON.parse(
      files.find((f) => f.path === ".codeium/windsurf/mcp_config.json")!.content,
    ) as { mcpServers: Record<string, { serverUrl?: string; url?: string }> };
    expect(mcp.mcpServers.remote!.serverUrl).toBe("https://mcp.example.com/mcp");
    expect(mcp.mcpServers.remote!.url).toBeUndefined();
    expect(files.some((f) => f.path === ".codeium/windsurf/memories/global_rules.md")).toBe(true);
  });

  it("skips memory with warning, plans skills, approximates persona into rules", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are Clawd.";
    bundle.memory = [{ content: "note", source: "MEMORY.md", kind: "long-term" }];
    bundle.skills = [{ name: "rev", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await ADAPTERS.windsurf.planImport(bundle, home);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
    expect(files.some((f) => f.path === ".codeium/windsurf/skills/rev/SKILL.md")).toBe(true);
    const rules = files.find((f) => f.path === ".codeium/windsurf/memories/global_rules.md")!;
    expect(rules.content).toContain("You are Clawd.");
  });
});
