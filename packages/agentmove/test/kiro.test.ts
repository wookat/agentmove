import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kiro } from "../src/adapters/kiro.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "kiro-home");

describe("kiro adapter", () => {
  it("exports servers, steering and skills from ~/.kiro", async () => {
    const { bundle, warnings } = await kiro.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName["web-search"]!.transport).toBe("stdio");
    expect(byName["web-search"]!.env).toEqual({ BRAVE_API_KEY: "test-not-a-real-token" });
    expect(byName.internal!.transport).toBe("http");
    expect(byName.internal!.enabled).toBe(false);
    expect(warnings.some((w) => w.includes("autoApprove"))).toBe(true);
    expect(bundle.instructions).toContain("Always use pnpm.");
    expect(bundle.instructions).toContain("steering: style.md");
    expect(warnings.some((w) => w.includes("steering files merged"))).toBe(true);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("imports with merge, native disabled flag, and steering AGENTS.md", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "http", url: "https://x.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await kiro.planImport(bundle, HOME, {});
    const mcp = JSON.parse(
      files.find((f) => f.path === ".kiro/settings/mcp.json")!.content,
    ) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(mcp.mcpServers["web-search"]).toBeDefined(); // merge keeps existing
    expect(mcp.mcpServers.docs!.command).toBe("npx");
    expect(mcp.mcpServers.docs!.type).toBeUndefined();
    expect(mcp.mcpServers.off!.disabled).toBe(true); // native disabled flag
    const agents = files.find((f) => f.path === ".kiro/steering/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("persona (SOUL.md)");
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(files.some((f) => f.path === ".kiro/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope: .kiro/settings/mcp.json + steering + skills", async () => {
    const adapter = getProjectAdapter("kiro");
    const exported = await adapter.exportProject(HOME); // fixture reuses .kiro layout
    expect(exported.bundle.mcpServers.map((s) => s.name).sort()).toEqual([
      "internal",
      "web-search",
    ]);
    expect(exported.bundle.instructions).toContain("Always use pnpm.");
    expect(exported.bundle.skills.map((s) => s.name)).toEqual(["review"]);

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx" }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const config = JSON.parse(
      files.find((f) => f.path === ".kiro/settings/mcp.json")!.content,
    ) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers.db).toBeDefined();
    expect(files.some((f) => f.path === ".kiro/steering/AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".kiro/skills/sk/SKILL.md")).toBe(true);
  });
});
