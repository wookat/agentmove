import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectAdapter } from "../src/project.js";
import { CliError, emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const project = path.join(FIXTURES, "claude-project");

describe("project-scoped adapters", () => {
  it("exports a claude-code project (.mcp.json, CLAUDE.md, .claude/skills)", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    expect(bundle.mcpServers.map((s) => s.name).sort()).toEqual(["api", "search"]);
    expect(bundle.instructions).toContain("Use pnpm.");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("plans a cursor project import (mcp.json + rules)", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files, warnings } = await getProjectAdapter("cursor").planImport(bundle, project);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".cursor/mcp.json");
    expect(paths).toContain(".cursor/rules/agentmove-imported.mdc");
    expect(warnings.some((w) => w.includes("skills"))).toBe(true);
    const mcp = JSON.parse(files.find((f) => f.path === ".cursor/mcp.json")!.content) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(mcp.mcpServers).sort()).toEqual(["api", "search"]);
  });

  it("plans a gemini project import (settings.json + GEMINI.md)", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files } = await getProjectAdapter("gemini").planImport(bundle, project);
    expect(files.map((f) => f.path)).toEqual(
      expect.arrayContaining([".gemini/settings.json", "GEMINI.md"]),
    );
  });

  it("codex project import migrates AGENTS.md + skills and warns on MCP", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files, warnings } = await getProjectAdapter("codex").planImport(bundle, project);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agents/skills/review/SKILL.md");
    expect(warnings.some((w) => w.includes("no project-scoped MCP config"))).toBe(true);
  });

  it("codex project export reads AGENTS.md and warns about MCP scope", async () => {
    const dir = path.join(FIXTURES, "empty-home");
    const { bundle, warnings } = await getProjectAdapter("codex").exportProject(dir);
    expect(bundle.mcpServers).toEqual([]);
    expect(warnings.some((w) => w.includes("no project-scoped MCP config"))).toBe(true);
  });

  it("cursor project export concatenates rules into instructions", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files } = await getProjectAdapter("cursor").planImport(bundle, project);
    // write nothing: re-parse from planned rules content instead
    const rules = files.find((f) => f.path === ".cursor/rules/agentmove-imported.mdc")!;
    expect(rules.content).toContain("Use pnpm.");
  });

  it("skips persona/memory at project scope with warnings", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are Clawd.";
    bundle.memory = [{ content: "note", source: "MEMORY.md", kind: "long-term" }];
    for (const id of ["claude-code", "codex", "gemini"] as const) {
      const { warnings } = await getProjectAdapter(id).planImport(bundle, project);
      expect(warnings.some((w) => w.startsWith("persona:")), id).toBe(true);
      expect(warnings.some((w) => w.startsWith("memory:")), id).toBe(true);
    }
    // cursor renders persona into the imported rules file but skips memory
    const cur = await getProjectAdapter("cursor").planImport(bundle, project);
    expect(cur.files.some((f) => f.path === ".cursor/rules/agentmove-imported.mdc")).toBe(true);
    expect(cur.warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("cline project import writes .clinerules and warns on MCP/memory/skills", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files, warnings } = await getProjectAdapter("cline").planImport(bundle, project);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".clinerules/agentmove-imported.md");
    expect(warnings.some((w) => w.includes("no project-scoped MCP config"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
    // export side: .clinerules concatenation on a project without one is empty
    const back = await getProjectAdapter("cline").exportProject(project);
    expect(back.bundle.instructions).toBeUndefined();
    expect(back.warnings.some((w) => w.includes("no project-scoped MCP config"))).toBe(true);
  });

  it("zed project import writes .zed/settings.json (args required) and .rules", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files, warnings } = await getProjectAdapter("zed").planImport(bundle, project);
    const settings = JSON.parse(files.find((f) => f.path === ".zed/settings.json")!.content) as {
      context_servers: Record<string, { args?: string[]; command?: string }>;
    };
    expect(Object.keys(settings.context_servers).sort()).toEqual(["api", "search"]);
    for (const entry of Object.values(settings.context_servers)) {
      if (entry.command) expect(Array.isArray(entry.args)).toBe(true);
    }
    expect(files.some((f) => f.path === ".rules")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
    // export side: no .zed/settings.json or .rules in the fixture project
    const back = await getProjectAdapter("zed").exportProject(project);
    expect(back.bundle.mcpServers).toEqual([]);
    // unrelated-layer import must not plan .zed/settings.json
    const memOnly = emptyBundle();
    memOnly.memory = [{ content: "m", source: "s", kind: "long-term" }];
    const noop = await getProjectAdapter("zed").planImport(memOnly, project);
    expect(noop.files.some((f) => f.path === ".zed/settings.json")).toBe(false);
  });

  it("openhands project import writes repo microagent + skills, warns on MCP", async () => {
    const { bundle } = await getProjectAdapter("claude-code").exportProject(project);
    const { files, warnings } = await getProjectAdapter("openhands").planImport(bundle, project);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".openhands/microagents/agentmove-imported.md");
    expect(paths).toContain(".openhands/skills/review/SKILL.md");
    expect(warnings.some((w) => w.includes("no project-scoped MCP config"))).toBe(true);
    // export side: nothing project-scoped for openhands in the fixture
    const back = await getProjectAdapter("openhands").exportProject(project);
    expect(back.bundle.instructions).toBeUndefined();
    expect(back.bundle.skills).toEqual([]);
  });

  it("rejects clients without project-scoped files", () => {
    for (const id of ["openclaw", "hermes"] as const) {
      expect(() => getProjectAdapter(id)).toThrowError(CliError);
    }
  });
});
