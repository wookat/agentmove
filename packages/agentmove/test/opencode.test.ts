import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import os from "node:os";
import { opencode, readOpencodeSkills } from "../src/adapters/opencode.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "opencode-home");

describe("opencode adapter", () => {
  it("exports MCP servers (argv command, environment, enabled), instructions, skills", async () => {
    const { bundle, warnings } = await opencode.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.everything!.transport).toBe("stdio");
    expect(byName.everything!.command).toBe("npx");
    expect(byName.everything!.args).toEqual(["-y", "@modelcontextprotocol/server-everything"]);
    expect(byName.everything!.env).toEqual({ MY_ENV_VAR: "value" });
    expect(byName.jira!.transport).toBe("http");
    expect(byName.jira!.url).toBe("https://jira.example.com/mcp");
    expect(byName.jira!.enabled).toBe(false);
    expect(bundle.instructions).toContain("TypeScript strict mode");
    expect(bundle.skills.map((s) => s.name)).toEqual([
      "fallback-root",
      "generic-only",
      "singular-root",
      "todo",
    ]);
    const todo = bundle.skills.find((s) => s.name === "todo")!;
    expect(todo.files["SKILL.md"]).toContain("Keep a running todo list");
    expect(warnings).toEqual([
      "skills:todo: .agents/skills copy shadowed by the .config/opencode/skills version (opencode keeps one skill per name); the .config/opencode/skills version is exported",
      "agents:reviewer: .config/opencode/agents copy shadowed by the .opencode/agent version (opencode keeps one agent per name); the .opencode/agent version is exported",
      "commands:team/review: .config/opencode/commands copy shadowed by the .opencode/commands version (opencode keeps one command per name); the .opencode/commands version is exported",
    ]);
  });

  it("merges skill roots in priority order with first-name-wins", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-oc-"));
    await fs.mkdir(path.join(home, ".config/opencode/skill/dup"), { recursive: true });
    await fs.writeFile(path.join(home, ".config/opencode/skill/dup/SKILL.md"), "singular dup\n");
    await fs.mkdir(path.join(home, ".opencode/skills/dup"), { recursive: true });
    await fs.writeFile(path.join(home, ".opencode/skills/dup/SKILL.md"), "fallback dup\n");
    await fs.mkdir(path.join(home, ".agents/skills/extra"), { recursive: true });
    await fs.writeFile(path.join(home, ".agents/skills/extra/SKILL.md"), "generic extra\n");
    const warnings: string[] = [];
    const skills = await readOpencodeSkills(
      home,
      [".config/opencode/skills", ".config/opencode/skill", ".opencode/skills", ".opencode/skill", ".agents/skills"],
      warnings,
    );
    expect(skills.map((s) => s.name)).toEqual(["dup", "extra"]);
    expect(skills[0]!.files["SKILL.md"]).toBe("singular dup\n");
    expect(warnings).toEqual([
      "skills:dup: .opencode/skills copy shadowed by the .config/opencode/skill version (opencode keeps one skill per name); the .config/opencode/skill version is exported",
    ]);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with OpenCode spellings (local/remote, argv command) and merge semantics", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["-y", "docs-mcp"], env: { A: "b" } },
      { name: "web", transport: "sse", url: "https://example.com/sse" },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await opencode.planImport(bundle, HOME, {});
    const mcp = files.find((f) => f.path === ".config/opencode/opencode.json")!;
    const config = JSON.parse(mcp.content) as {
      mcp: Record<
        string,
        { type?: string; command?: string[]; environment?: Record<string, string>; enabled?: boolean }
      >;
    };
    expect(config.mcp.docs!.type).toBe("local");
    expect(config.mcp.docs!.command).toEqual(["npx", "-y", "docs-mcp"]);
    expect(config.mcp.docs!.environment).toEqual({ A: "b" });
    expect(config.mcp.web!.type).toBe("remote");
    expect(config.mcp.off!.enabled).toBe(false);
    // existing fixture servers survive the merge
    expect(config.mcp.everything).toBeDefined();
    expect(config.mcp.jira).toBeDefined();
    expect(files.some((f) => f.path === ".config/opencode/AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".config/opencode/skills/sk/SKILL.md")).toBe(true);
    expect(files.some((f) => f.path.startsWith(".agents/skills/"))).toBe(false);
    expect(files.some((f) => f.path.startsWith(".opencode/"))).toBe(false);
    expect(warnings.some((w) => w.includes("no sse type"))).toBe(true);
  });

  it("warns on memory and approximates persona into AGENTS.md", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "m", source: "s", kind: "long-term" }];
    const { files, warnings } = await opencode.planImport(bundle, HOME, {});
    expect(files.some((f) => f.path === ".config/opencode/opencode.json")).toBe(false);
    expect(files.find((f) => f.path === ".config/opencode/AGENTS.md")!.content).toContain(
      "You are helpful.",
    );
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
  });

  it("project scope: opencode.json + AGENTS.md + .opencode/skills", async () => {
    const adapter = getProjectAdapter("opencode");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx", args: ["db-mcp"] }];
    bundle.instructions = "Repo-wide rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const mcp = files.find((f) => f.path === "opencode.json")!;
    const config = JSON.parse(mcp.content) as { mcp: Record<string, { type?: string; command?: string[] }> };
    expect(config.mcp.db!.type).toBe("local");
    expect(config.mcp.db!.command).toEqual(["npx", "db-mcp"]);
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".opencode/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope: exports .opencode/{skills,skill} and .agents/skills with brand precedence", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-ocp-"));
    await fs.mkdir(path.join(dir, ".opencode/skills/proj"), { recursive: true });
    await fs.writeFile(path.join(dir, ".opencode/skills/proj/SKILL.md"), "brand proj\n");
    await fs.mkdir(path.join(dir, ".agents/skills/proj"), { recursive: true });
    await fs.writeFile(path.join(dir, ".agents/skills/proj/SKILL.md"), "generic proj\n");
    await fs.mkdir(path.join(dir, ".agents/skills/proj-generic"), { recursive: true });
    await fs.writeFile(path.join(dir, ".agents/skills/proj-generic/SKILL.md"), "generic only\n");
    const adapter = getProjectAdapter("opencode");
    const { bundle, warnings } = await adapter.exportProject(dir);
    expect(bundle.skills.map((s) => s.name)).toEqual(["proj", "proj-generic"]);
    expect(bundle.skills[0]!.files["SKILL.md"]).toBe("brand proj\n");
    expect(
      warnings.some((w) => w.startsWith("skills:proj: .agents/skills copy shadowed")),
    ).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("project scope: merges .opencode/{agents,agent} and {commands,command} with plural precedence", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-oca-"));
    await fs.mkdir(path.join(dir, ".opencode/agents/team"), { recursive: true });
    await fs.writeFile(path.join(dir, ".opencode/agents/team/helper.md"), "plural helper\n");
    await fs.mkdir(path.join(dir, ".opencode/agent/team"), { recursive: true });
    await fs.writeFile(path.join(dir, ".opencode/agent/team/helper.md"), "singular helper\n");
    await fs.writeFile(path.join(dir, ".opencode/agent/solo.md"), "solo\n");
    await fs.mkdir(path.join(dir, ".opencode/command"), { recursive: true });
    await fs.writeFile(path.join(dir, ".opencode/command/lint.md"), "lint\n");
    const adapter = getProjectAdapter("opencode");
    const { bundle, warnings } = await adapter.exportProject(dir);
    expect(bundle.agents.map((a) => a.name)).toEqual(["solo", "team/helper"]);
    expect(bundle.agents.find((a) => a.name === "team/helper")!.content).toBe("plural helper\n");
    expect(warnings).toContain(
      "agents:team/helper: .opencode/agent copy shadowed by the .opencode/agents version (opencode keeps one agent per name); the .opencode/agents version is exported",
    );
    expect(bundle.commands.map((c) => c.name)).toEqual(["lint"]);
    expect(bundle.commands[0]!.content).toBe("lint\n");
    await fs.rm(dir, { recursive: true, force: true });
  });
});
