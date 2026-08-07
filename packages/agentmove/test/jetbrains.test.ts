import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jetbrains } from "../src/adapters/jetbrains.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "jetbrains-home");
const PROJECT = path.join(FIXTURES, "jetbrains-project");

interface JetbrainsConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("jetbrains adapter", () => {
  it("detects the fixture home and not an empty one", async () => {
    expect(await jetbrains.detect(HOME)).toBe(true);
    expect(await jetbrains.detect(path.join(FIXTURES, "empty-home"))).toBe(false);
  });

  it("exports mcp servers with native workingDirectory as cwd", async () => {
    const { bundle, warnings } = await jetbrains.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.context7!.transport).toBe("stdio");
    expect(byName.context7!.env).toEqual({ CONTEXT7_API_KEY: "test-not-a-real-token" });
    expect(byName.context7!.cwd).toBe("/tmp/ctx7");
    expect(byName.youtrack!.transport).toBe("http"); // url entry, no type field
    expect(byName.youtrack!.headers).toEqual({ Authorization: "Bearer test-not-a-real-token" });
    expect(bundle.instructions).toBeUndefined();
    expect(warnings.some((w) => w.includes("use --project"))).toBe(true);
  });

  it("imports by merging; cwd becomes workingDirectory; unsupported layers warn", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/srv/docs" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await jetbrains.planImport(bundle, HOME, {});
    expect(files.map((f) => f.path)).toEqual([".ai/mcp/mcp.json"]);
    const config = JSON.parse(files[0]!.content) as JetbrainsConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "context7",
      "docs",
      "events",
      "youtrack",
    ]);
    expect(config.mcpServers!.docs!.workingDirectory).toBe("/srv/docs");
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse written without a transport type"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });

  it("supports --replace-mcp", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const { files, warnings } = await jetbrains.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(files[0]!.content) as JetbrainsConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope reads .ai/mcp/mcp.json and merged .aiassistant rules", async () => {
    const adapter = getProjectAdapter("jetbrains");
    const { bundle, warnings } = await adapter.exportProject(PROJECT);
    expect(bundle.mcpServers.map((s) => s.name)).toEqual(["idea-mcp"]);
    expect(bundle.instructions).toContain("Kotlin coroutines");
    expect(bundle.instructions).toContain("Four-space indent");
    expect(warnings.some((w) => w.includes("merged into one document"))).toBe(true);
  });

  it("project scope imports mcp merge and writes rules/agentmove.md", async () => {
    const adapter = getProjectAdapter("jetbrains");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "http", url: "https://docs.example.com/mcp" }];
    bundle.instructions = "Follow the roadmap.";
    const { files, warnings } = await adapter.planImport(bundle, PROJECT, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".ai/mcp/mcp.json")!.content,
    ) as JetbrainsConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["docs", "idea-mcp"]);
    const rules = files.find((f) => f.path === ".aiassistant/rules/agentmove.md")!;
    expect(rules.content).toBe("Follow the roadmap.");
    expect(warnings.some((w) => w.includes("rule type"))).toBe(true);
  });
});
