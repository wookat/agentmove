import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { vibe } from "../src/adapters/vibe.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "vibe-home");

interface VibeConfig {
  active_model?: string;
  mcp_servers?: Record<string, unknown>[];
}

function byName(config: VibeConfig): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    (config.mcp_servers ?? []).map((e) => [String(e.name), e as Record<string, unknown>]),
  );
}

describe("vibe adapter", () => {
  it("exports stdio/http servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await vibe.exportBundle(HOME);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.filesystem!.transport).toBe("stdio");
    expect(servers.filesystem!.command).toBe("npx");
    expect(servers.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(servers["api-server"]!.transport).toBe("http");
    expect(servers["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Always run tests");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("startup_timeout_sec"))).toBe(true);
  });

  it("warns for client-specific api_key/tool filter settings on export", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-flags-"));
    await fs.mkdir(path.join(home, ".vibe"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".vibe/config.toml"),
      `[[mcp_servers]]\nname = "linear"\ntransport = "http"\nurl = "https://mcp.linear.app/mcp"\napi_key_env = "LINEAR_API_KEY"\napi_key_header = "Authorization"\ndisabled_tools = ["delete_*"]\n`,
    );
    const { bundle, warnings } = await vibe.exportBundle(home);
    expect(bundle.mcpServers[0]!.name).toBe("linear");
    expect(warnings.some((w) => w.includes("api_key_env"))).toBe(true);
    expect(warnings.some((w) => w.includes("disabled_tools"))).toBe(true);
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
    const { files, warnings } = await vibe.planImport(bundle, HOME, {});
    const config = parseToml(
      files.find((f) => f.path === ".vibe/config.toml")!.content,
    ) as VibeConfig;
    expect(config.active_model).toBe("devstral-medium"); // unrelated key preserved
    const servers = byName(config);
    expect(Object.keys(servers).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(servers.filesystem!.startup_timeout_sec).toBe(30); // existing entry untouched
    expect(servers.docs!.transport).toBe("stdio");
    expect(servers.docs!.cwd).toBeUndefined();
    expect(servers.events!.transport).toBe("http");
    expect(servers.events!.url).toBe("https://e.example.com/sse");
    expect(servers.remote!.transport).toBe("http");
    expect(warnings.some((w) => w.includes("does not document cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no sse transport"))).toBe(true);
    expect(warnings.some((w) => w.includes("no per-server disabled flag"))).toBe(true);
    const agents = files.find((f) => f.path === ".vibe/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".vibe/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await vibe.planImport(bundle, HOME, { replaceMcp: true });
    const config = parseToml(
      files.find((f) => f.path === ".vibe/config.toml")!.content,
    ) as VibeConfig;
    expect(Object.keys(byName(config))).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .vibe/config.toml + AGENTS.md + .vibe/skills", async () => {
    const adapter = getProjectAdapter("vibe");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-proj-"));
    await fs.mkdir(path.join(dir, ".vibe"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".vibe/config.toml"),
      `[[mcp_servers]]\nname = "existing"\ntransport = "stdio"\ncommand = "node"\nargs = ["srv.js"]\n`,
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = parseToml(
      files.find((f) => f.path === ".vibe/config.toml")!.content,
    ) as VibeConfig;
    const servers = byName(config);
    expect(Object.keys(servers).sort()).toEqual(["existing", "search"]);
    expect(servers.search!.url).toBe("https://s.example.com");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".vibe/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("exports agent profiles with custom prompt bodies and per-field warnings", async () => {
    const { bundle, warnings } = await vibe.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["ghost", "lite", "reviewer"]);
    const reviewer = bundle.agents.find((a) => a.name === "reviewer")!;
    expect(reviewer.content).toContain('description: "Thorough code reviewer"');
    expect(reviewer.content).toContain("Review the code carefully and report issues.");
    const lite = bundle.agents.find((a) => a.name === "lite")!;
    expect(lite.content).toBe('---\ndescription: "Minimal profile"\n---\n');
    expect(warnings).toContain("agents:reviewer: vibe display_name has no portable equivalent; dropped");
    expect(warnings).toContain(
      'agents:reviewer: vibe safety level "safe" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:reviewer: vibe agent_type "subagent" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:reviewer: vibe config override "disabled_tools" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:ghost: system_prompt_id "lean" does not resolve to a custom prompt markdown file (builtin or missing); body not exported',
    );
    expect(warnings).toContain("agents:broken.toml: invalid TOML; not migrated");
  });

  it("imports agents as profile TOML + prompt file wired via system_prompt_id", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      { name: "helper", content: '---\ndescription: "Helps out"\n---\nBe helpful.\n' },
      { name: "team/planner", content: "Plan the work.\n" },
      { name: "plan", content: '---\ndescription: "Custom plan"\n---\nPlan differently.\n' },
      { name: "desc-only", content: '---\ndescription: "No body"\n---\n' },
    ];
    const { files, warnings } = await vibe.planImport(bundle, HOME, {});
    const helper = parseToml(
      files.find((f) => f.path === ".vibe/agents/helper.toml")!.content,
    ) as Record<string, unknown>;
    expect(helper.description).toBe("Helps out");
    expect(helper.system_prompt_id).toBe("helper");
    expect(files.find((f) => f.path === ".vibe/prompts/helper.md")!.content).toBe("Be helpful.\n");
    expect(files.some((f) => f.path === ".vibe/agents/team-planner.toml")).toBe(true);
    expect(files.some((f) => f.path === ".vibe/prompts/team-planner.md")).toBe(true);
    expect(warnings).toContain(
      "agents:team/planner: vibe agent and prompt names must be bare filenames; imported as team-planner",
    );
    expect(warnings).toContain(
      'agents:plan: a custom profile with this name overrides vibe\'s builtin "plan" agent',
    );
    const descOnly = parseToml(
      files.find((f) => f.path === ".vibe/agents/desc-only.toml")!.content,
    ) as Record<string, unknown>;
    expect(descOnly.system_prompt_id).toBeUndefined();
    expect(files.some((f) => f.path === ".vibe/prompts/desc-only.md")).toBe(false);
  });

  it("project scope: .vibe/agents + .vibe/prompts round-trip", async () => {
    const adapter = getProjectAdapter("vibe");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-agents-proj-"));
    await fs.mkdir(path.join(dir, ".vibe/agents"), { recursive: true });
    await fs.mkdir(path.join(dir, ".vibe/prompts"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".vibe/agents/tester.toml"),
      'description = "Runs tests"\nsystem_prompt_id = "tester"\n',
    );
    await fs.writeFile(path.join(dir, ".vibe/prompts/tester.md"), "Run all tests.\n");
    const { bundle: exported } = await adapter.exportProject(dir);
    expect(exported.agents.map((a) => a.name)).toEqual(["tester"]);
    expect(exported.agents[0]!.content).toContain("Run all tests.");

    const target = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-agents-proj2-"));
    const { files } = await adapter.planImport(exported, target, {});
    expect(files.find((f) => f.path === ".vibe/prompts/tester.md")!.content).toBe(
      "Run all tests.\n",
    );
    const tester = parseToml(
      files.find((f) => f.path === ".vibe/agents/tester.toml")!.content,
    ) as Record<string, unknown>;
    expect(tester.description).toBe("Runs tests");
    expect(tester.system_prompt_id).toBe("tester");
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  });
});
