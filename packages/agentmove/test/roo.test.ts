import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { roo } from "../src/adapters/roo.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const MODES_REL =
  ".config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/custom_modes.yaml";

interface RooMode {
  slug: string;
  name: string;
  description?: string;
  roleDefinition: string;
  groups: unknown[];
}

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "roo-home");
const MCP_REL =
  ".config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json";

describe("roo adapter", () => {
  it("exports servers (streamable-http/sse), rules and skills", async () => {
    const { bundle, warnings } = await roo.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName["local-tools"]!.transport).toBe("stdio");
    expect(byName["local-tools"]!.env).toEqual({ API_KEY: "test-not-a-real-token" });
    expect(byName["modern-remote"]!.transport).toBe("http");
    expect(byName["modern-remote"]!.enabled).toBe(false);
    expect(byName["legacy-remote"]!.transport).toBe("sse");
    expect(warnings.some((w) => w.includes("alwaysAllow"))).toBe(true);
    expect(bundle.instructions).toContain("Always use pnpm.");
    expect(bundle.instructions).toContain("rule: 02-style.md");
    expect(warnings.some((w) => w.includes("rules files merged"))).toBe(true);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("imports with merge, explicit remote type, native disabled, rules file", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "http", url: "https://x.example.com", enabled: false },
      { name: "old", transport: "sse", url: "https://old.example.com" },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await roo.planImport(bundle, HOME, {});
    const mcp = JSON.parse(files.find((f) => f.path === MCP_REL)!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(mcp.mcpServers["local-tools"]).toBeDefined(); // merge keeps existing
    expect(mcp.mcpServers.docs!.command).toBe("npx");
    expect(mcp.mcpServers.docs!.type).toBeUndefined(); // stdio: type omitted
    expect(mcp.mcpServers.off!.type).toBe("streamable-http"); // Roo requires explicit type
    expect(mcp.mcpServers.off!.disabled).toBe(true); // native disabled flag
    expect(mcp.mcpServers.old!.type).toBe("sse");
    const rules = files.find((f) => f.path === ".roo/rules/agentmove.md")!;
    expect(rules.content).toContain("Do good work.");
    expect(rules.content).toContain("persona (SOUL.md)");
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(files.some((f) => f.path === ".roo/skills/sk/SKILL.md")).toBe(true);
  });

  it("handles a missing home gracefully and --replace-mcp semantics", async () => {
    const { bundle, warnings } = await roo.exportBundle("/nonexistent-home");
    expect(bundle.mcpServers).toEqual([]);
    expect(bundle.instructions).toBeUndefined();
    expect(bundle.skills).toEqual([]);
    expect(warnings).toEqual([]);

    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await roo.planImport(incoming, HOME, { replaceMcp: true });
    const mcp = JSON.parse(replaced.files.find((f) => f.path === MCP_REL)!.content) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(mcp.mcpServers)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("exports custom modes as portable agents with per-field drop warnings", async () => {
    const { bundle, warnings } = await roo.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["code-reviewer", "docs-helper"]);
    expect(bundle.agents.find((a) => a.name === "code-reviewer")!.content).toBe(
      '---\ndescription: "Reviews code for style and correctness"\n---\nYou are a careful code reviewer.\nFocus on correctness first.\n',
    );
    expect(bundle.agents.find((a) => a.name === "docs-helper")!.content).toBe(
      "You write documentation.\n",
    );
    expect(warnings).toContain(
      'agents:code-reviewer: roo mode field "whenToUse" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:code-reviewer: roo mode field "customInstructions" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:code-reviewer: roo mode field "groups" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      "agents:code-reviewer: roo display name (🔍 Code Reviewer) has no portable equivalent; the slug is used",
    );
    expect(
      warnings.some((w) => w.startsWith("agents:docs-helper: roo display name")),
    ).toBe(false);
    expect(warnings).toContain(
      "agents:broken-mode: mode has neither roleDefinition nor description; not migrated",
    );
    expect(warnings).toContain("agents: custom mode entry has no slug; not migrated");
    expect(
      warnings.some((w) => w.includes("converted from roo custom modes")),
    ).toBe(true);
  });

  it("imports agents as custom modes, merging over existing modes by slug", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      {
        name: "docs-writer",
        content: '---\ndescription: "Writes docs"\n---\nYou write documentation.\n',
      },
      { name: "backend/sql", content: "You are a SQL expert.\n" },
      { name: "multi", content: "---\ndescription: d\nmode: subagent\n---\nBody here.\n" },
      { name: "code-reviewer", content: "Replacement reviewer.\n" },
    ];
    const { files, warnings } = await roo.planImport(bundle, HOME, {});
    const plan = files.find((f) => f.path === MODES_REL)!;
    const parsed = parseYaml(plan.content) as { customModes: RooMode[] };
    const bySlug = Object.fromEntries(parsed.customModes.map((m) => [m.slug, m]));
    expect(bySlug["docs-writer"]!.description).toBe("Writes docs");
    expect(bySlug["docs-writer"]!.roleDefinition).toBe("You write documentation.\n");
    expect(bySlug["docs-writer"]!.name).toBe("docs-writer");
    expect(bySlug["docs-writer"]!.groups).toEqual(["read", "edit", "browser", "command", "mcp"]);
    expect(bySlug["backend-sql"]).toBeDefined();
    expect(warnings).toContain(
      "agents:backend/sql: roo mode slugs cannot be nested; imported as backend-sql",
    );
    expect(bySlug.multi!.roleDefinition).toContain("mode: subagent");
    expect(warnings).toContain(
      "agents:multi: frontmatter has fields beyond description, which roo custom modes cannot express; kept verbatim inside roleDefinition",
    );
    expect(bySlug["code-reviewer"]!.roleDefinition).toBe("Replacement reviewer.\n");
    expect(warnings).toContain(
      "agents:code-reviewer: overwrote existing roo custom mode with the same slug",
    );
    expect(bySlug["docs-helper"]!.roleDefinition).toBe("You write documentation.");
    expect(warnings.some((w) => w.includes("written as roo custom modes"))).toBe(true);
  });

  it("round-trips portable fields roo → agentmove → roo", async () => {
    const { bundle } = await roo.exportBundle(HOME);
    const { files } = await roo.planImport(bundle, "/nonexistent-home", {});
    const plan = files.find((f) => f.path.endsWith("custom_modes.yaml"))!;
    const parsed = parseYaml(plan.content) as { customModes: RooMode[] };
    const reviewer = parsed.customModes.find((m) => m.slug === "code-reviewer")!;
    expect(reviewer.description).toBe("Reviews code for style and correctness");
    expect(reviewer.roleDefinition).toBe(
      "You are a careful code reviewer.\nFocus on correctness first.\n",
    );
  });

  it("project scope: .roo/mcp.json + rules + skills", async () => {
    const adapter = getProjectAdapter("roo");
    const exported = await adapter.exportProject(HOME); // fixture reuses .roo layout
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["project-db"]);
    expect(exported.bundle.instructions).toContain("Always use pnpm.");
    expect(exported.bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(exported.bundle.agents.map((a) => a.name)).toEqual(["project-helper"]);
    expect(exported.bundle.agents[0]!.content).toBe(
      '---\ndescription: "Helps with this repo"\n---\nYou know this repository well.\n',
    );

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    bundle.agents = [{ name: "tester", content: "You write tests.\n" }];
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const roomodes = parseYaml(files.find((f) => f.path === ".roomodes")!.content) as {
      customModes: RooMode[];
    };
    expect(roomodes.customModes.map((m) => m.slug)).toEqual(["tester"]);
    expect(roomodes.customModes[0]!.roleDefinition).toBe("You write tests.\n");
    const config = JSON.parse(files.find((f) => f.path === ".roo/mcp.json")!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(config.mcpServers.db!.type).toBe("streamable-http");
    expect(files.some((f) => f.path === ".roo/rules/agentmove.md")).toBe(true);
    expect(files.some((f) => f.path === ".roo/skills/sk/SKILL.md")).toBe(true);
  });
});
