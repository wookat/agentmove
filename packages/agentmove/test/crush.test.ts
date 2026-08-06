import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { crush } from "../src/adapters/crush.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "crush-home");

interface CrushConfig {
  mcp: Record<string, Record<string, unknown>>;
}

describe("crush adapter", () => {
  it("exports servers from the mcp map with native disabled + client-specific warnings", async () => {
    const { bundle, warnings } = await crush.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.env).toEqual({ API_KEY: "test-not-a-real-token" });
    expect(byName.github!.transport).toBe("http");
    expect(byName.github!.enabled).toBe(false);
    expect(byName.streaming!.transport).toBe("sse");
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
    expect(warnings.some((w) => w.includes("disabled_tools"))).toBe(true);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
  });

  it("imports by merging the mcp map, preserves disabled flag, plans skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "http", url: "https://x.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await crush.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".config/crush/crush.json")!.content,
    ) as CrushConfig;
    expect(Object.keys(config.mcp)).toContain("filesystem"); // merge keeps existing
    expect(config.mcp.filesystem!.timeout).toBe(120); // client keys untouched
    expect(config.mcp.docs!.type).toBe("stdio");
    expect(config.mcp.off!.type).toBe("http");
    expect(config.mcp.off!.disabled).toBe(true);
    expect(files.some((f) => f.path === ".config/crush/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await crush.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".config/crush/crush.json")!.content,
    ) as CrushConfig;
    expect(Object.keys(config.mcp)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const { bundle } = await crush.exportBundle("/nonexistent-home");
    expect(bundle.mcpServers).toEqual([]);
  });

  it("project scope: .crush.json/crush.json + CRUSH.md + .crush/skills", async () => {
    const adapter = getProjectAdapter("crush");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-crush-"));
    await fs.writeFile(
      path.join(dir, "crush.json"),
      JSON.stringify({ mcp: { local: { type: "stdio", command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "CRUSH.md"), "# Repo rules\n");
    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["local"]);
    expect(exported.bundle.instructions).toContain("Repo rules");

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === "crush.json")!.content,
    ) as CrushConfig;
    expect(Object.keys(config.mcp).sort()).toEqual(["db", "local"]);
    expect(config.mcp.db!.type).toBe("http");
    expect(files.some((f) => f.path === "CRUSH.md")).toBe(true);
    expect(files.some((f) => f.path === ".crush/skills/review/SKILL.md")).toBe(true);
  });
});
