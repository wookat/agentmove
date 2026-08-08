import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auggie, readAuggieAgents } from "../src/adapters/auggie.js";
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

  it("exports custom agents recursively, excluding decoys and hidden entries", async () => {
    const { bundle, warnings } = await auggie.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["backend/sql", "code-reviewer"]);
    const reviewer = bundle.agents.find((a) => a.name === "code-reviewer")!;
    expect(reviewer.content).toContain("name: code-reviewer");
    expect(reviewer.content).toContain("You are a code review specialist.");
    expect(warnings).toEqual([]);
  });

  it("exports .txt agents with a warning; .md wins a same-name collision", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "auggie-agents-"));
    const root = path.join(home, ".augment/agents");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dual.md"), "Markdown wins.\n");
    await fs.writeFile(path.join(root, "dual.txt"), "Text loses.\n");
    await fs.writeFile(path.join(root, "plain.txt"), "Plain text agent.\n");
    await fs.writeFile(path.join(root, ".hidden.md"), "Hidden, skipped.\n");
    const warnings: string[] = [];
    const agents = await readAuggieAgents(root, warnings);
    expect(agents.map((a) => a.name)).toEqual(["dual", "plain"]);
    expect(agents.find((a) => a.name === "dual")!.content).toBe("Markdown wins.\n");
    expect(warnings).toContain(
      "agents:dual: both .md and .txt agent files exist; the .md file was exported",
    );
    expect(warnings).toContain(
      "agents:plain: auggie .txt agent exported; imported elsewhere as markdown",
    );
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports agents into ~/.augment/agents preserving nested names, with review warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      { name: "backend/sql", content: "---\ndescription: SQL helper\n---\nSQL body.\n" },
      { name: "reviewer", content: "Just a prompt.\n" },
    ];
    const { files, warnings } = await auggie.planImport(bundle, HOME, {});
    const nested = files.find((f) => f.path === ".augment/agents/backend/sql.md")!;
    expect(nested.content).toContain("SQL body.");
    expect(files.find((f) => f.path === ".augment/agents/reviewer.md")!.content).toBe(
      "Just a prompt.\n",
    );
    expect(warnings).toContain(
      "agents: frontmatter fields (name/description/color/model/tools/disabled_tools) are client-specific and copied as-is; review after import",
    );
  });

  it("round-trips agents byte-for-byte through export -> import", async () => {
    const { bundle } = await auggie.exportBundle(HOME);
    const { files } = await auggie.planImport(bundle, HOME, {});
    const reviewer = bundle.agents.find((a) => a.name === "code-reviewer")!;
    expect(files.find((f) => f.path === ".augment/agents/code-reviewer.md")!.content).toBe(
      reviewer.content,
    );
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

  it("project scope: exports and imports .augment/agents", async () => {
    const adapter = getProjectAdapter("auggie");
    expect(adapter.supportsAgents).toBe(true);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "auggie-proj-agents-"));
    await fs.mkdir(path.join(dir, ".augment/agents"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".augment/agents/tester.md"),
      "---\nname: tester\n---\nTest things.\n",
    );
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.agents.map((a) => a.name)).toEqual(["tester"]);
    expect(expWarnings).toEqual([]);

    const bundle = emptyBundle();
    bundle.agents = exported.agents;
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    expect(files.find((f) => f.path === ".augment/agents/tester.md")!.content).toBe(
      "---\nname: tester\n---\nTest things.\n",
    );
    expect(warnings.some((w) => w.includes("client-specific"))).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
