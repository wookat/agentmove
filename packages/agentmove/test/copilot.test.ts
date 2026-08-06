import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copilot } from "../src/adapters/copilot.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "copilot-home");

describe("copilot adapter", () => {
  it("exports MCP servers (local -> stdio) and user instructions", async () => {
    const { bundle, warnings } = await copilot.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.github!.transport).toBe("http");
    expect(byName.github!.url).toBe("https://api.githubcopilot.com/mcp/");
    expect(byName.github!.headers!.Authorization).toContain("Bearer");
    expect(bundle.instructions).toContain("Always write tests first.");
    expect(bundle.instructions).toContain("TypeScript strict mode");
    // client-specific tool allowlists are reported, not silently dropped
    expect(warnings.some((w) => w.includes("tool allowlist"))).toBe(true);
  });

  it("imports with Copilot transport spelling and merge semantics", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["-y", "docs-mcp"] },
      { name: "web", transport: "http", url: "https://example.com/mcp" },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    const { files, warnings } = await copilot.planImport(bundle, HOME, {});
    const mcp = files.find((f) => f.path === ".copilot/mcp-config.json")!;
    const config = JSON.parse(mcp.content) as {
      mcpServers: Record<string, { type?: string; url?: string }>;
    };
    expect(config.mcpServers.docs!.type).toBe("local");
    expect(config.mcpServers.web!.type).toBe("http");
    // existing fixture servers survive the merge
    expect(config.mcpServers.filesystem).toBeDefined();
    expect(config.mcpServers.github).toBeDefined();
    const instr = files.find(
      (f) => f.path === ".copilot/instructions/agentmove-imported.instructions.md",
    )!;
    expect(instr.content).toContain("Do good work.");
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
  });

  it("warns on memory/skills and approximates persona into instructions", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "m", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await copilot.planImport(bundle, HOME, {});
    expect(files.some((f) => f.path === ".copilot/mcp-config.json")).toBe(false);
    expect(
      files.find((f) => f.path.endsWith("agentmove-imported.instructions.md"))!.content,
    ).toContain("You are helpful.");
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
  });

  it("project scope: .mcp.json + .github instructions round-trip", async () => {
    const adapter = getProjectAdapter("copilot");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx", args: ["db-mcp"] }];
    bundle.instructions = "Repo-wide rules.";
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const mcp = files.find((f) => f.path === ".mcp.json")!;
    const config = JSON.parse(mcp.content) as { mcpServers: Record<string, { type?: string }> };
    expect(config.mcpServers.db!.type).toBe("local");
    expect(
      files.some((f) => f.path === ".github/instructions/agentmove-imported.instructions.md"),
    ).toBe(true);
  });
});
