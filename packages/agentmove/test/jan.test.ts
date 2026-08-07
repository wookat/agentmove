import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { jan } from "../src/adapters/jan.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "jan-home");
const MCP_REL = ".local/share/Jan/data/mcp_config.json";

interface JanConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
  mcpSettings?: Record<string, unknown>;
}

describe("jan adapter", () => {
  it("exports stdio/http servers with client-specific warnings", async () => {
    const { bundle, warnings } = await jan.exportBundle(HOME);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.filesystem!.transport).toBe("stdio");
    expect(servers.filesystem!.command).toBe("npx");
    expect(servers.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(servers.filesystem!.enabled).toBeUndefined();
    expect(servers["api-server"]!.transport).toBe("http");
    expect(servers["api-server"]!.command).toBeUndefined();
    expect(servers["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
  });

  it("round-trips active:false as enabled:false and reads sse entries", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "jan-active-"));
    await fs.mkdir(path.join(home, ".local/share/Jan/data"), { recursive: true });
    await fs.writeFile(
      path.join(home, MCP_REL),
      JSON.stringify({
        mcpServers: {
          paused: { command: "node", args: ["srv.js"], env: {}, active: false },
          legacy: { command: "", args: [], type: "sse", url: "https://e.example.com/sse" },
          official: { command: "npx", args: ["x"], env: {}, active: false, official: true },
        },
      }),
    );
    const { bundle, warnings } = await jan.exportBundle(home);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.paused!.enabled).toBe(false);
    expect(servers.legacy!.transport).toBe("sse");
    expect(warnings.some((w) => w.includes("official"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, preserves mcpSettings, warns for cwd", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/srv" },
      { name: "events", transport: "sse", url: "https://e.example.com/sse", enabled: false },
      { name: "remote", transport: "http", url: "https://example.com/mcp" },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await jan.planImport(bundle, HOME, {});
    const config = JSON.parse(files.find((f) => f.path === MCP_REL)!.content) as JanConfig;
    expect(config.mcpSettings).toEqual({ toolCallTimeoutSeconds: 30 });
    const servers = config.mcpServers!;
    expect(Object.keys(servers).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(servers["api-server"]!.timeout).toBe(30);
    expect(servers.docs!.command).toBe("npx");
    expect(servers.docs!.cwd).toBeUndefined();
    expect(servers.events!.type).toBe("sse");
    expect(servers.events!.command).toBe("");
    expect(servers.events!.args).toEqual([]);
    expect(servers.events!.active).toBe(false);
    expect(servers.remote!.type).toBe("http");
    expect(warnings.some((w) => w.includes("does not support cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("assistant instructions are app-managed"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
    expect(warnings.some((w) => w.includes("no SKILL.md mechanism"))).toBe(true);
    expect(files.every((f) => f.path === MCP_REL)).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await jan.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(files.find((f) => f.path === MCP_REL)!.content) as JanConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });
});
