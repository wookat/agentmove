import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { trae } from "../src/adapters/trae.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "trae-home");

interface TraeConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("trae adapter", () => {
  it("exports global skills; user-level MCP/rules are app-managed with warnings", async () => {
    const { bundle, warnings } = await trae.exportBundle(HOME);
    expect(bundle.mcpServers).toEqual([]);
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("app-managed (Settings > MCP)"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
  });

  it("user-scope import writes only skills and warns for the other layers", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await trae.planImport(bundle, HOME, {});
    expect(files.map((f) => f.path)).toEqual([".trae/skills/sk/SKILL.md"]);
    expect(warnings.some((w) => w.includes("import with --project to write .trae/mcp.json"))).toBe(true);
    expect(warnings.some((w) => w.includes("--project to write .trae/rules"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("project scope: .trae/mcp.json merge, rules, and skills", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-trae-proj-"));
    await fs.mkdir(path.join(dir, ".trae/rules"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".trae/mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, ".trae/rules/style.md"), "Use tabs.");
    const adapter = getProjectAdapter("trae");

    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.bundle.instructions).toContain("Use tabs.");

    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Project rules.";
    bundle.persona = "You are helpful.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".trae/mcp.json")!.content,
    ) as TraeConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["docs", "events", "existing"]);
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse written without a transport type"))).toBe(true);
    expect(warnings.some((w) => w.includes("Enable Project MCP"))).toBe(true);
    const rules = files.find((f) => f.path === ".trae/rules/agentmove-imported.md")!;
    expect(rules.content).toContain("Project rules.");
    expect(rules.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".trae/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope supports --replace-mcp", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-trae-proj-"));
    await fs.mkdir(path.join(dir, ".trae"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".trae/mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    const adapter = getProjectAdapter("trae");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const { files, warnings } = await adapter.planImport(bundle, dir, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".trae/mcp.json")!.content,
    ) as TraeConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });
});
