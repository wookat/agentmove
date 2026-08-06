import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { droid } from "../src/adapters/droid.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "droid-home");

interface DroidConfig {
  mcpServers: Record<string, Record<string, unknown>>;
}

describe("droid adapter", () => {
  it("exports servers from mcpServers with native disabled + client-specific warnings", async () => {
    const { bundle, warnings } = await droid.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.airtable!.transport).toBe("stdio");
    expect(byName.airtable!.env).toEqual({ AIRTABLE_API_KEY: "test-not-a-real-token" });
    expect(byName.linear!.transport).toBe("http");
    expect(byName.linear!.enabled).toBe(false);
    expect(byName.internal!.headers).toEqual({ Authorization: "Bearer test-not-a-real-token" });
    expect(warnings.some((w) => w.includes("disabledTools"))).toBe(true);
    expect(warnings.some((w) => w.includes("oauth"))).toBe(true);
    expect(bundle.instructions).toContain("Always use pnpm");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("imports by merging mcpServers, writes AGENTS.md, plans skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "http", url: "https://x.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await droid.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".factory/mcp.json")!.content,
    ) as DroidConfig;
    expect(Object.keys(config.mcpServers)).toContain("airtable"); // merge keeps existing
    expect(config.mcpServers.airtable!.disabledTools).toEqual(["delete_records"]);
    expect(config.mcpServers.internal!.oauth).toBe(false);
    expect(config.mcpServers.docs!.type).toBe("stdio");
    expect(config.mcpServers.off!.type).toBe("http");
    expect(config.mcpServers.off!.disabled).toBe(true);
    const agents = files.find((f) => f.path === ".factory/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".factory/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await droid.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".factory/mcp.json")!.content,
    ) as DroidConfig;
    expect(Object.keys(config.mcpServers)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const { bundle } = await droid.exportBundle("/nonexistent-home");
    expect(bundle.mcpServers).toEqual([]);
  });

  it("project scope: .factory/mcp.json + AGENTS.md + .factory/skills", async () => {
    const adapter = getProjectAdapter("droid");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-droid-"));
    await fs.mkdir(path.join(dir, ".factory"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".factory/mcp.json"),
      JSON.stringify({ mcpServers: { local: { type: "stdio", command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Repo rules\n");
    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["local"]);
    expect(exported.bundle.instructions).toContain("Repo rules");

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".factory/mcp.json")!.content,
    ) as DroidConfig;
    expect(Object.keys(config.mcpServers).sort()).toEqual(["db", "local"]);
    expect(config.mcpServers.db!.type).toBe("http");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".factory/skills/review/SKILL.md")).toBe(true);
  });
});
