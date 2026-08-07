import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auggie } from "../src/adapters/auggie.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "auggie-home");

interface AuggieSettings {
  theme?: string;
  enableChatInputCompletions?: boolean;
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("auggie adapter", () => {
  it("exports servers, user rules, and skills from ~/.augment", async () => {
    const { bundle, warnings } = await auggie.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Use pnpm");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("merges multiple user rules files into one document with a warning", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "auggie-rules-"));
    await fs.mkdir(path.join(home, ".augment/rules"), { recursive: true });
    await fs.writeFile(path.join(home, ".augment/rules/a.md"), "Rule A.\n");
    await fs.writeFile(path.join(home, ".augment/rules/b.md"), "Rule B.\n");
    const { bundle, warnings } = await auggie.exportBundle(home);
    expect(bundle.instructions).toContain("Rule A.");
    expect(bundle.instructions).toContain("Rule B.");
    expect(warnings.some((w) => w.includes("merged into one document"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports by merging mcpServers into settings.json, preserving other keys", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/x" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await auggie.planImport(bundle, HOME, {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".augment/settings.json")!.content,
    ) as AuggieSettings;
    expect(settings.theme).toBe("ansi"); // unrelated settings preserved
    expect(settings.enableChatInputCompletions).toBe(true);
    expect(Object.keys(settings.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
    ]);
    expect(settings.mcpServers!.docs!.type).toBe("stdio");
    expect(settings.mcpServers!.docs!.cwd).toBeUndefined();
    expect(settings.mcpServers!.events!.type).toBe("sse");
    const rulesFile = files.find((f) => f.path === ".augment/rules/agentmove.md")!;
    expect(rulesFile.content).toContain("Do good work.");
    expect(rulesFile.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".augment/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("memories are app-managed"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await auggie.planImport(bundle, HOME, { replaceMcp: true });
    const settings = JSON.parse(
      files.find((f) => f.path === ".augment/settings.json")!.content,
    ) as AuggieSettings;
    expect(Object.keys(settings.mcpServers!)).toEqual(["docs"]);
    expect(settings.theme).toBe("ansi");
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .augment/settings.json + .augment/rules + .augment/skills", async () => {
    const adapter = getProjectAdapter("auggie");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "auggie-proj-"));
    await fs.mkdir(path.join(dir, ".augment/rules"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".augment/settings.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } }, permissions: [] }),
    );
    await fs.writeFile(path.join(dir, ".augment/rules/team.md"), "# Project notes\n");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "stdio", command: "npx" }];
    bundle.instructions = "Project rules.";
    bundle.persona = "Friendly.";
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".augment/settings.json")!.content,
    ) as AuggieSettings & { permissions?: unknown };
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcpServers!.search!.type).toBe("stdio");
    expect(config.permissions).toEqual([]); // unrelated project settings preserved
    const rules = files.find((f) => f.path === ".augment/rules/agentmove.md")!;
    expect(rules.content).toContain("Project rules.");
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);

    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Project notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
