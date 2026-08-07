import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { anythingllm } from "../src/adapters/anythingllm.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "anythingllm-home");
const MCP_REL = ".config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json";

interface AllmConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("anythingllm adapter", () => {
  it("exports stdio/streamable servers with client-specific warnings", async () => {
    const { bundle, warnings } = await anythingllm.exportBundle(HOME);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.filesystem!.transport).toBe("stdio");
    expect(servers.filesystem!.command).toBe("npx");
    expect(servers.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(servers.filesystem!.enabled).toBeUndefined();
    expect(servers["api-server"]!.transport).toBe("http");
    expect(servers["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(warnings.some((w) => w.includes("suppressedTools"))).toBe(true);
  });

  it("reads autoStart:false as enabled:false and defaults url entries to sse", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "allm-"));
    await fs.mkdir(path.dirname(path.join(home, MCP_REL)), { recursive: true });
    await fs.writeFile(
      path.join(home, MCP_REL),
      JSON.stringify({
        mcpServers: {
          paused: { command: "node", args: ["srv.js"], anythingllm: { autoStart: false } },
          legacy: { url: "https://e.example.com/sse" },
          explicit: { type: "http", url: "https://e.example.com/mcp" },
        },
      }),
    );
    const { bundle } = await anythingllm.exportBundle(home);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.paused!.enabled).toBe(false);
    expect(servers.legacy!.transport).toBe("sse");
    expect(servers.explicit!.transport).toBe("http");
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, maps transports, warns for unsupported layers", async () => {
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
    const { files, warnings } = await anythingllm.planImport(bundle, HOME, {});
    const config = JSON.parse(files.find((f) => f.path === MCP_REL)!.content) as AllmConfig;
    const servers = config.mcpServers!;
    expect(Object.keys(servers).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(servers.filesystem!.anythingllm).toEqual({ suppressedTools: ["delete_file"] });
    expect(servers.docs!.command).toBe("npx");
    expect(servers.docs!.cwd).toBeUndefined();
    expect(servers.events!.type).toBe("sse");
    expect(servers.events!.anythingllm).toEqual({ autoStart: false });
    expect(servers.remote!.type).toBe("streamable");
    expect(warnings.some((w) => w.includes("does not support cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("system prompts are app-managed"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
    expect(warnings.some((w) => w.includes("no SKILL.md mechanism"))).toBe(true);
    expect(files.every((f) => f.path === MCP_REL)).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await anythingllm.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(files.find((f) => f.path === MCP_REL)!.content) as AllmConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });
});
