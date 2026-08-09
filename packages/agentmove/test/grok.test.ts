import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import {
  grok,
  GROK_AGENTS_EXPORT_WARNING,
  GROK_AGENTS_IMPORT_WARNING,
} from "../src/adapters/grok.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "grok-home");

interface GrokConfig {
  cli?: Record<string, unknown>;
  mcp_servers?: Record<string, Record<string, unknown>>;
}

describe("grok adapter", () => {
  it("exports stdio/http servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await grok.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Prefer small commits");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(bundle.agents.map((a) => a.name)).toEqual(["reviewer"]);
    expect(bundle.agents[0]!.content).toBe("Review the code carefully and report issues.\n");
    expect(warnings).toContain(
      'agents:reviewer: grok per-agent model "grok-4.3" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      "agents:explore: reserved built-in sub-agent name; grok ignores the entry; not migrated",
    );
    expect(warnings).toContain(
      "agents:Reviewer: duplicate sub-agent name; grok keeps the first entry; not migrated",
    );
    expect(warnings).toContain(
      "agents:blank: sub-agent has no instruction; nothing portable; not migrated",
    );
    expect(warnings).toContain(
      "agents: subAgents entry without a name; grok ignores it; not migrated",
    );
    expect(warnings).toContain(GROK_AGENTS_EXPORT_WARNING);
  });

  it("reads legacy .grok/skills with a warning; .agents/skills shadows same names", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "grok-skills-"));
    await fs.mkdir(path.join(home, ".agents/skills/dual"), { recursive: true });
    await fs.mkdir(path.join(home, ".grok/skills/dual"), { recursive: true });
    await fs.mkdir(path.join(home, ".grok/skills/legacy-only"), { recursive: true });
    await fs.writeFile(path.join(home, ".agents/skills/dual/SKILL.md"), "preferred\n");
    await fs.writeFile(path.join(home, ".grok/skills/dual/SKILL.md"), "legacy\n");
    await fs.writeFile(path.join(home, ".grok/skills/legacy-only/SKILL.md"), "old\n");
    const { bundle, warnings } = await grok.exportBundle(home);
    expect(bundle.skills.map((s) => s.name)).toEqual(["dual", "legacy-only"]);
    expect(bundle.skills.find((s) => s.name === "dual")!.files["SKILL.md"]).toBe("preferred\n");
    expect(warnings).toContain(
      "skills:dual: legacy .grok/skills copy shadowed by .agents/skills; the .agents/skills version is exported",
    );
    expect(warnings).toContain(
      "skills:legacy-only: read from .grok/skills, which grok does not load; imports write .agents/skills",
    );
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports agents as subAgents entries, preserving unrelated settings", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      { name: "reviewer", content: "New reviewer instructions.\n" },
      { name: "team/planner", content: "Plan the work.\n" },
      { name: "vision", content: "Reserved name.\n" },
      {
        name: "fancy",
        content: '---\ndescription: "Fancy agent"\ntools: ["bash"]\n---\nDo fancy things.\n',
      },
    ];
    const { files, warnings } = await grok.planImport(bundle, HOME, {});
    expect(files.some((f) => f.path === ".grok/config.toml")).toBe(false);
    const settings = JSON.parse(
      files.find((f) => f.path === ".grok/user-settings.json")!.content,
    ) as {
      apiKey?: string;
      defaultModel?: string;
      subAgents: { name: string; model: string; instruction: string }[];
    };
    expect(settings.apiKey).toBe("test-not-a-real-token"); // unrelated keys preserved
    expect(settings.defaultModel).toBe("grok-4.3");
    const byName = Object.fromEntries(settings.subAgents.map((a) => [a.name, a]));
    expect(byName.reviewer!.instruction).toBe("New reviewer instructions.\n");
    expect(byName.reviewer!.model).toBe("grok-4.3");
    expect(byName["team-planner"]!.instruction).toBe("Plan the work.\n");
    expect(byName.fancy!.instruction).toContain('description: "Fancy agent"');
    expect(byName.vision).toBeUndefined();
    // pre-existing entries are kept verbatim, including ones grok itself ignores
    expect(settings.subAgents.some((a) => a.name === "explore")).toBe(true);
    expect(warnings).toContain(
      "agents:reviewer: overwrites the existing sub-agent with the same name",
    );
    expect(warnings).toContain(
      "agents:team/planner: grok sub-agent names are plain strings; imported as team-planner",
    );
    expect(warnings).toContain(
      "agents:vision: name is reserved for a grok built-in sub-agent; grok would ignore it; skipped",
    );
    expect(warnings).toContain(
      "agents:fancy: grok sub-agents have no metadata fields; frontmatter kept verbatim inside the instruction",
    );
    expect(warnings).toContain(GROK_AGENTS_IMPORT_WARNING);
  });

  it("agents-only imports never touch config.toml; mcp-only never touch user-settings.json", async () => {
    const agentsOnly = emptyBundle();
    agentsOnly.agents = [{ name: "helper", content: "Help out.\n" }];
    const { files: agentFiles } = await grok.planImport(agentsOnly, HOME, {});
    expect(agentFiles.map((f) => f.path)).toEqual([".grok/user-settings.json"]);

    const mcpOnly = emptyBundle();
    mcpOnly.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files: mcpFiles } = await grok.planImport(mcpOnly, HOME, {});
    expect(mcpFiles.map((f) => f.path)).toEqual([".grok/config.toml"]);
  });

  it("warns for client-specific timeout settings on export", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "grok-flags-"));
    await fs.mkdir(path.join(home, ".grok"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".grok/config.toml"),
      `[mcp_servers.slow]\ncommand = "npx"\nstartup_timeout_sec = 60\ntool_timeout_sec = 600\n`,
    );
    const { bundle, warnings } = await grok.exportBundle(home);
    expect(bundle.mcpServers[0]!.name).toBe("slow");
    expect(warnings.some((w) => w.includes("timeout settings are client-specific"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, preserves unrelated config, warns for disabled/cwd/sse", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/srv" },
      { name: "events", transport: "sse", url: "https://e.example.com/sse", enabled: false },
      { name: "remote", transport: "http", url: "https://example.com/mcp" },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await grok.planImport(bundle, HOME, {});
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(config.cli).toEqual({ theme: "dark" }); // unrelated table preserved
    expect(Object.keys(config.mcp_servers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(config.mcp_servers!.docs!.command).toBe("npx");
    expect(config.mcp_servers!.docs!.cwd).toBeUndefined();
    expect(config.mcp_servers!.events!.url).toBe("https://e.example.com/sse");
    expect(config.mcp_servers!.remote!.url).toBe("https://example.com/mcp");
    expect(warnings.some((w) => w.includes("does not document cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no documented sse transport"))).toBe(true);
    expect(warnings.some((w) => w.includes("no documented disabled flag"))).toBe(true);
    const agents = files.find((f) => f.path === ".grok/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await grok.planImport(bundle, HOME, { replaceMcp: true });
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(Object.keys(config.mcp_servers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .grok/config.toml + AGENTS.md + .agents/skills", async () => {
    const adapter = getProjectAdapter("grok");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "grok-proj-"));
    await fs.mkdir(path.join(dir, ".grok"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".grok/config.toml"),
      `[mcp_servers.existing]\ncommand = "node"\nargs = ["srv.js"]\n`,
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(Object.keys(config.mcp_servers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcp_servers!.search!.url).toBe("https://s.example.com");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    await fs.mkdir(path.join(dir, ".agents/skills/review"), { recursive: true });
    await fs.writeFile(path.join(dir, ".agents/skills/review/SKILL.md"), "y");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(exported.skills.map((s) => s.name)).toEqual(["review"]);
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
