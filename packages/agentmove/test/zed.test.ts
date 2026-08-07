import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zed } from "../src/adapters/zed.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "zed-home");

describe("zed adapter", () => {
  it("exports context_servers (JSONC settings) and personal AGENTS.md", async () => {
    const { bundle, warnings } = await zed.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.files!.transport).toBe("stdio");
    expect(byName.remote!.transport).toBe("http");
    expect(byName.remote!.url).toBe("https://mcp.example.com/mcp");
    expect(bundle.instructions).toContain("Use pnpm everywhere.");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.includes("Rules Library"))).toBe(true);
  });

  it("imports with merge semantics, required args, and a JSONC-comment warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "solo", transport: "stdio", command: "srv" }];
    bundle.instructions = "Do good work.";
    const { files, warnings } = await zed.planImport(bundle, HOME, {});
    const settingsPlan = files.find((f) => f.path === ".config/zed/settings.json")!;
    const settings = JSON.parse(settingsPlan.content) as {
      theme?: string;
      context_servers: Record<string, { args?: string[] }>;
    };
    expect(settings.theme).toBe("One Dark"); // unrelated settings preserved
    expect(settings.context_servers.solo!.args).toEqual([]); // Zed requires args
    expect(settings.context_servers.files).toBeDefined(); // merge keeps existing
    expect(files.find((f) => f.path === ".config/zed/AGENTS.md")!.content).toContain(
      "Do good work.",
    );
    expect(warnings.some((w) => w.includes("JSONC comments"))).toBe(true);
  });

  it("warns on memory, plans skills into ~/.agents/skills, skips settings on unrelated-layer imports", async () => {
    const bundle = emptyBundle();
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "m", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await zed.planImport(bundle, HOME, {});
    expect(files.some((f) => f.path === ".config/zed/settings.json")).toBe(false);
    expect(files.find((f) => f.path === ".config/zed/AGENTS.md")!.content).toContain(
      "You are helpful.",
    );
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
  });

  it("project scope: plans skills into .agents/skills", async () => {
    const adapter = getProjectAdapter("zed");
    const bundle = emptyBundle();
    bundle.skills = [{ name: "review", files: { "SKILL.md": "# Review" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.some((f) => f.path === ".agents/skills/review/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
  });
});
