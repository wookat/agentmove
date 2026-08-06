import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qwen } from "../src/adapters/qwen.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "qwen-home");

describe("qwen adapter", () => {
  it("exports MCP servers (incl. httpUrl), instructions, added memories, skills", async () => {
    const { bundle, warnings } = await qwen.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.mainServer!.transport).toBe("stdio");
    expect(byName.mainServer!.command).toBe("npx");
    expect(byName.remoteServer!.transport).toBe("http");
    expect(byName.remoteServer!.url).toBe("https://mcp.example.com/http");
    expect(bundle.instructions).toContain("small, reviewed commits");
    expect(bundle.instructions).not.toContain("Added Memories");
    expect(bundle.memory.map((m) => m.content)).toEqual([
      "The user prefers TypeScript strict mode.",
      "The project uses pnpm workspaces.",
    ]);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(warnings).toEqual([]);
  });

  it("imports MCP (merge), instructions + memories into QWEN.md, skills natively", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await qwen.planImport(bundle, HOME, {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".qwen/settings.json")!.content,
    ) as { mcpServers: Record<string, unknown> };
    expect(settings.mcpServers.docs).toBeDefined();
    expect(settings.mcpServers.mainServer).toBeDefined(); // merge keeps existing
    const context = files.find((f) => f.path === ".qwen/QWEN.md")!.content;
    expect(context).toContain("Do good work.");
    expect(context).toContain("## Qwen Added Memories");
    expect(context).toContain("- likes tabs");
    expect(files.some((f) => f.path === ".qwen/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
  });

  it("project scope: .qwen/settings.json + QWEN.md + .qwen/skills", async () => {
    const adapter = getProjectAdapter("qwen");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx", args: ["db-mcp"] }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.some((f) => f.path === ".qwen/settings.json")).toBe(true);
    expect(files.some((f) => f.path === "QWEN.md")).toBe(true);
    expect(files.some((f) => f.path === ".qwen/skills/sk/SKILL.md")).toBe(true);
  });
});
