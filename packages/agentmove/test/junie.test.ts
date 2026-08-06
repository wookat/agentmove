import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { junie } from "../src/adapters/junie.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "junie-home");

interface JunieConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("junie adapter", () => {
  it("exports mcp servers, global AGENTS.md guidelines, and skills", async () => {
    const { bundle, warnings } = await junie.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.context7!.transport).toBe("stdio");
    expect(byName.context7!.env).toEqual({ CONTEXT7_API_KEY: "test-not-a-real-token" });
    expect(byName.internal!.transport).toBe("http"); // url entry, no type field
    expect(byName.internal!.headers).toEqual({ Authorization: "Bearer test-not-a-real-token" });
    expect(bundle.instructions).toContain("Always use pnpm.");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review-helper"]);
    expect(warnings).toEqual([]);
  });

  it("imports by merging; no type or disabled fields; persona approximated", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await junie.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".junie/mcp/mcp.json")!.content,
    ) as JunieConfig;
    expect(Object.keys(config.mcpServers!)).toContain("context7"); // merge keeps existing
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse written without a transport type"))).toBe(true);
    const agents = files.find((f) => f.path === ".junie/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(files.some((f) => f.path === ".junie/skills/sk/SKILL.md")).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await junie.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".junie/mcp/mcp.json")!.content,
    ) as JunieConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const missing = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-junie-"));
    const { bundle, warnings } = await junie.exportBundle(missing);
    expect(bundle.mcpServers).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("project scope: .junie/mcp/mcp.json + .junie/AGENTS.md with guidelines.md fallback", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-junie-proj-"));
    await fs.mkdir(path.join(dir, ".junie/mcp"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".junie/mcp/mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    await fs.mkdir(path.join(dir, ".junie"), { recursive: true });
    await fs.writeFile(path.join(dir, ".junie/guidelines.md"), "Legacy rules.");
    const adapter = getProjectAdapter("junie");

    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.bundle.instructions).toBe("Legacy rules."); // legacy fallback

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".junie/mcp/mcp.json")!.content,
    ) as JunieConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["docs", "existing"]);
    expect(files.find((f) => f.path === ".junie/AGENTS.md")!.content).toBe("Project rules.");
    expect(files.some((f) => f.path === ".junie/skills/sk/SKILL.md")).toBe(true);
  });
});
