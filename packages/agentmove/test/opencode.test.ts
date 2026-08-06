import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { opencode } from "../src/adapters/opencode.js";
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
    expect(bundle.skills.map((s) => s.name)).toEqual(["todo"]);
    expect(warnings).toEqual([]);
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
});
