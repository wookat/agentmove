import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { roo } from "../src/adapters/roo.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

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

  it("project scope: .roo/mcp.json + rules + skills", async () => {
    const adapter = getProjectAdapter("roo");
    const exported = await adapter.exportProject(HOME); // fixture reuses .roo layout
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["project-db"]);
    expect(exported.bundle.instructions).toContain("Always use pnpm.");
    expect(exported.bundle.skills.map((s) => s.name)).toEqual(["review"]);

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const config = JSON.parse(files.find((f) => f.path === ".roo/mcp.json")!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(config.mcpServers.db!.type).toBe("streamable-http");
    expect(files.some((f) => f.path === ".roo/rules/agentmove.md")).toBe(true);
    expect(files.some((f) => f.path === ".roo/skills/sk/SKILL.md")).toBe(true);
  });
});
