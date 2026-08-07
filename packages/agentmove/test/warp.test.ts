import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { warp } from "../src/adapters/warp.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "warp-home");

interface WarpConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
  mcp_servers?: Record<string, Record<string, unknown>>;
}

describe("warp adapter", () => {
  it("exports servers with working_directory mapped to cwd", async () => {
    const { bundle, warnings } = await warp.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.fetch!.transport).toBe("stdio");
    expect(byName.fetch!.cwd).toBe("/tmp/fetch-home");
    expect(byName.fetch!.env).toEqual({ FETCH_API_KEY: "test-not-a-real-token" });
    expect(byName.internal!.transport).toBe("http"); // no type field: url implies remote
    expect(byName.internal!.headers).toEqual({ Authorization: "Bearer test-not-a-real-token" });
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("imports by merging; no type field, cwd as working_directory; other layers warn", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/repo" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await warp.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".warp/.mcp.json")!.content,
    ) as WarpConfig;
    expect(Object.keys(config.mcpServers!)).toContain("fetch"); // merge keeps existing
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.docs!.working_directory).toBe("/repo");
    expect(config.mcpServers!.docs!.cwd).toBeUndefined();
    expect(config.mcpServers!.events!.url).toBe("https://sse.example.com");
    expect(config.mcpServers!.events!.disabled).toBeUndefined();
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("auto-negotiate transport"))).toBe(true);
    expect(files.some((f) => f.path === ".warp/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
  });

  it("preserves an alternate wrapper key and supports --replace-mcp / missing homes", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-warp-"));
    await fs.mkdir(path.join(dir, ".warp"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".warp/.mcp.json"),
      JSON.stringify({ mcp_servers: { legacy: { command: "node" } } }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const merged = await warp.planImport(bundle, dir, {});
    const config = JSON.parse(
      merged.files.find((f) => f.path === ".warp/.mcp.json")!.content,
    ) as WarpConfig;
    expect(Object.keys(config.mcp_servers!).sort()).toEqual(["docs", "legacy"]);
    expect(config.mcpServers).toBeUndefined();

    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await warp.planImport(incoming, HOME, { replaceMcp: true });
    const replacedConfig = JSON.parse(
      replaced.files.find((f) => f.path === ".warp/.mcp.json")!.content,
    ) as WarpConfig;
    expect(Object.keys(replacedConfig.mcpServers!)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const { bundle: none } = await warp.exportBundle("/nonexistent-home");
    expect(none.mcpServers).toEqual([]);
  });

  it("project scope: .warp/.mcp.json + AGENTS.md (reads legacy WARP.md)", async () => {
    const adapter = getProjectAdapter("warp");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-warp-proj-"));
    await fs.mkdir(path.join(dir, ".warp"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".warp/.mcp.json"),
      JSON.stringify({ mcpServers: { local: { command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "WARP.md"), "# Repo rules\n");
    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["local"]);
    expect(exported.bundle.instructions).toContain("Repo rules");

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".warp/.mcp.json")!.content,
    ) as WarpConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["db", "local"]);
    expect(config.mcpServers!.db!.type).toBeUndefined();
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".warp/skills/review/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
  });
});
