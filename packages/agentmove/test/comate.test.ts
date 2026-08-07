import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { comate } from "../src/adapters/comate.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "comate-home");

interface ComateConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("comate adapter", () => {
  it("exports global skills; user-level MCP/rules are project-scoped with warnings", async () => {
    const { bundle, warnings } = await comate.exportBundle(HOME);
    expect(bundle.mcpServers).toEqual([]);
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("project-scoped (.comate/mcp.json)"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
  });

  it("user-scope import writes only skills and warns for the other layers", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await comate.planImport(bundle, HOME, {});
    expect(files.map((f) => f.path)).toEqual([".comate/skills/sk/SKILL.md"]);
    expect(warnings.some((w) => w.includes("import with --project to write .comate/mcp.json"))).toBe(
      true,
    );
    expect(warnings.some((w) => w.includes(".comate/rules/*.mdr"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("project scope: .comate/mcp.json merge, .mdr rules, and skills", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-comate-proj-"));
    await fs.mkdir(path.join(dir, ".comate/rules"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".comate/mcp.json"),
      JSON.stringify({
        mcpServers: {
          existing: { command: "node" },
          remote: {
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer test-not-a-real-token" },
          },
        },
      }),
    );
    await fs.writeFile(
      path.join(dir, ".comate/rules/style.mdr"),
      "---\ndescription:\nglobs:\nalwaysApply: true\n---\n\nUse tabs.",
    );
    const adapter = getProjectAdapter("comate");

    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name).sort()).toEqual(["existing", "remote"]);
    expect(exported.bundle.instructions).toContain("Use tabs.");
    expect(
      exported.warnings.some((w) => w.includes("comate project rules concatenated")),
    ).toBe(true);

    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Project rules.";
    bundle.persona = "You are helpful.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".comate/mcp.json")!.content,
    ) as ComateConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["docs", "events", "existing", "remote"]);
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse written without a transport type"))).toBe(true);
    const rules = files.find((f) => f.path === ".comate/rules/agentmove-imported.mdr")!;
    expect(rules.content).toContain("alwaysApply: true");
    expect(rules.content).toContain("Project rules.");
    expect(rules.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".comate/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope supports --replace-mcp", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-comate-proj-"));
    await fs.mkdir(path.join(dir, ".comate"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".comate/mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    const adapter = getProjectAdapter("comate");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const { files, warnings } = await adapter.planImport(bundle, dir, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".comate/mcp.json")!.content,
    ) as ComateConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });
});
