import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { muse } from "../src/adapters/muse.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "muse-home");
const PROJECT = path.join(FIXTURES, "muse-project");

interface MuseSettings {
  schema_version?: number;
  theme?: string;
  mcp_servers?: Record<string, Record<string, unknown>>;
}

describe("muse adapter", () => {
  it("exports stdio/streamable_http servers and skills, warns on mode", async () => {
    const { bundle, warnings } = await muse.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("mode"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
  });

  it("imports with merge, keeps schema_version and other settings keys", async () => {
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
    const { files, warnings } = await muse.planImport(bundle, HOME, {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".config/muse/settings.json")!.content,
    ) as MuseSettings;
    expect(settings.schema_version).toBe(1);
    expect(settings.theme).toBe("dark");
    expect(Object.keys(settings.mcp_servers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(settings.mcp_servers!.docs).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["docs-mcp"],
    });
    expect(settings.mcp_servers!.events).toEqual({
      transport: "streamable_http",
      url: "https://e.example.com/sse",
      enabled: false,
    });
    expect(settings.mcp_servers!.remote).toEqual({
      transport: "streamable_http",
      url: "https://example.com/mcp",
    });
    // existing entry preserved with its client-specific mode
    expect(settings.mcp_servers!["api-server"]!.mode).toBe("optional");
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("SSE"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions/persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(files.some((f) => f.path === ".config/muse/skills/sk/SKILL.md")).toBe(true);
  });

  it("writes schema_version on a fresh settings file", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files } = await muse.planImport(bundle, "/nonexistent-home", {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".config/muse/settings.json")!.content,
    ) as MuseSettings;
    expect(settings.schema_version).toBe(1);
  });

  it("project scope: exports AGENTS.md, skills, and .agents/memory", async () => {
    const adapter = getProjectAdapter("muse");
    const { bundle, warnings } = await adapter.exportProject(PROJECT);
    expect(bundle.instructions).toContain("Always write tests first");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(bundle.memory.map((m) => m.source)).toEqual(["MEMORY.md", "memory/deploy.md"]);
    expect(warnings.some((w) => w.startsWith("mcp:"))).toBe(true);
  });

  it("project scope: plans AGENTS.md, memory file, and skills", async () => {
    const adapter = getProjectAdapter("muse");
    const bundle = emptyBundle();
    bundle.persona = "You are helpful.";
    bundle.instructions = "Follow the checklist.";
    bundle.memory = [{ content: "m", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "review", files: { "SKILL.md": "# Review" } }];
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.find((f) => f.path === "AGENTS.md")!.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".agents/memory/agentmove.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/review/SKILL.md")).toBe(true);
    expect(files.some((f) => f.path.includes("settings.json"))).toBe(false);
    expect(warnings.some((w) => w.startsWith("mcp:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });
});
