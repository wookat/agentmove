import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cline } from "../src/adapters/cline.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "cline-home");

describe("cline adapter", () => {
  it("exports MCP servers (transport + disabled normalized) and global rules", async () => {
    const { bundle, warnings } = await cline.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.files!.transport).toBe("stdio");
    expect(byName.files!.enabled).toBe(false);
    expect(byName.remote!.transport).toBe("http");
    expect(byName.remote!.url).toBe("https://mcp.example.com/mcp");
    expect(byName["legacy-sse"]!.transport).toBe("sse");
    expect(bundle.instructions).toContain("TypeScript strict mode");
    expect(bundle.instructions).toContain("Prefer small PRs");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("globalStorage"))).toBe(true);
  });

  it("imports with Cline transport spelling, disabled flag, and merge semantics", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "web", transport: "http", url: "https://example.com/mcp" },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    const { files, warnings } = await cline.planImport(bundle, HOME, {});
    const mcp = files.find((f) => f.path.endsWith("cline_mcp_settings.json"))!;
    const config = JSON.parse(mcp.content) as {
      mcpServers: Record<string, { type?: string; disabled?: boolean }>;
    };
    expect(config.mcpServers.web!.type).toBe("streamableHttp");
    expect(config.mcpServers.off!.disabled).toBe(true);
    // existing fixture servers survive the merge
    expect(config.mcpServers.files).toBeDefined();
    expect(config.mcpServers.remote).toBeDefined();
    const rules = files.find((f) => f.path === "Documents/Cline/Rules/agentmove-imported.md")!;
    expect(rules.content).toContain("Do good work.");
    expect(warnings).toEqual([]);
  });

  it("warns on memory, plans skills into ~/.cline/skills, approximates persona into rules", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "m", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await cline.planImport(bundle, HOME, {});
    expect(files.some((f) => f.path.endsWith("cline_mcp_settings.json"))).toBe(false);
    expect(files.find((f) => f.path.endsWith("agentmove-imported.md"))!.content).toContain(
      "You are helpful.",
    );
    expect(files.some((f) => f.path === ".cline/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
  });

  it("project scope: plans skills into .cline/skills", async () => {
    const adapter = getProjectAdapter("cline");
    const bundle = emptyBundle();
    bundle.skills = [{ name: "review", files: { "SKILL.md": "# Review" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.some((f) => f.path === ".cline/skills/review/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
  });
});
