import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { antigravity } from "../src/adapters/antigravity.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "antigravity-home");

interface AntigravityConfig {
  mcpServers: Record<string, Record<string, unknown>>;
}

describe("antigravity adapter", () => {
  it("exports servers with serverUrl normalization, native disabled + client-specific warnings", async () => {
    const { bundle, warnings } = await antigravity.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName["sqlite-explorer"]!.transport).toBe("stdio");
    expect(byName["sqlite-explorer"]!.env!.API_KEY).toBe("test-not-a-real-token");
    expect(byName["remote-api"]!.transport).toBe("http");
    expect(byName["remote-api"]!.url).toBe("https://api.example.com/mcp/");
    expect(byName["remote-api"]!.enabled).toBe(false);
    expect(byName["gcp-service"]!.transport).toBe("http");
    expect(warnings.some((w) => w.includes("disabledTools"))).toBe(true);
    expect(warnings.some((w) => w.includes("authProviderType"))).toBe(true);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
    expect(warnings.some((w) => w.includes("GEMINI.md"))).toBe(true);
  });

  it("imports by merging mcpServers, renders serverUrl + disabled, plans skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "off", transport: "http", url: "https://x.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await antigravity.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".gemini/config/mcp_config.json")!.content,
    ) as AntigravityConfig;
    expect(Object.keys(config.mcpServers)).toContain("sqlite-explorer"); // merge keeps existing
    expect(config.mcpServers["sqlite-explorer"]!.disabledTools).toEqual(["drop_table"]);
    expect(config.mcpServers.docs!.command).toBe("npx");
    expect(config.mcpServers.docs!.type).toBeUndefined();
    expect(config.mcpServers.off!.serverUrl).toBe("https://x.example.com");
    expect(config.mcpServers.off!.url).toBeUndefined();
    expect(config.mcpServers.off!.disabled).toBe(true);
    expect(files.some((f) => f.path === ".gemini/config/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await antigravity.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".gemini/config/mcp_config.json")!.content,
    ) as AntigravityConfig;
    expect(Object.keys(config.mcpServers)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const { bundle } = await antigravity.exportBundle("/nonexistent-home");
    expect(bundle.mcpServers).toEqual([]);
  });

  it("project scope: .agents/mcp_config.json + rules/ + skills/", async () => {
    const adapter = getProjectAdapter("antigravity");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-antigravity-"));
    await fs.mkdir(path.join(dir, ".agents/rules"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".agents/mcp_config.json"),
      JSON.stringify({ mcpServers: { local: { command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, ".agents/rules/01-style.md"), "# Repo rules\n");
    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["local"]);
    expect(exported.bundle.instructions).toContain("Repo rules");

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".agents/mcp_config.json")!.content,
    ) as AntigravityConfig;
    expect(Object.keys(config.mcpServers).sort()).toEqual(["db", "local"]);
    expect(config.mcpServers.db!.serverUrl).toBe("https://db.example.com");
    expect(files.some((f) => f.path === ".agents/rules/agentmove.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/review/SKILL.md")).toBe(true);
  });
});
