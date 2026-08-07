import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPluginDir, PLUGIN_MCP_SCHEMA, PLUGIN_SCHEMA, readPlugin, writePlugin } from "../src/plugin.js";
import { CliError, emptyBundle } from "../src/model.js";

function bundle() {
  const b = emptyBundle();
  b.manifest.exportedFrom = "openclaw";
  b.mcpServers = [
    {
      name: "filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      env: { FS_API_KEY: "${FS_API_KEY}" },
    },
    {
      name: "api",
      transport: "http",
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer ${API_TOKEN}" },
    },
    { name: "legacy", transport: "sse", url: "https://sse.example.com/mcp" },
  ];
  b.instructions = "Use pnpm.";
  b.persona = "# Soul";
  b.memory = [{ content: "note", source: "MEMORY.md", kind: "long-term" }];
  b.skills = [{ name: "review", files: { "SKILL.md": "# review", "scripts/run.sh": "echo hi" } }];
  return b;
}

describe("Agent Plugins export/import", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-plugin-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes a conformant plugin directory", async () => {
    const warnings = await writePlugin(bundle(), dir, "my-agent");
    const manifest = JSON.parse(await fs.readFile(path.join(dir, "plugin.json"), "utf8")) as {
      $schema: string;
      name: string;
    };
    expect(manifest.$schema).toBe(PLUGIN_SCHEMA);
    expect(manifest.name).toBe("my-agent");
    const mcp = JSON.parse(await fs.readFile(path.join(dir, "mcp.json"), "utf8")) as {
      $schema: string;
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(mcp.$schema).toBe(PLUGIN_MCP_SCHEMA);
    expect(mcp.mcpServers.filesystem.type).toBe("stdio");
    expect(mcp.mcpServers.api.type).toBe("streamable-http");
    expect(mcp.mcpServers.api.headers).toEqual({ Authorization: "Bearer ${API_TOKEN}" });
    expect(mcp.mcpServers.legacy.type).toBe("sse");
    expect(await fs.readFile(path.join(dir, "skills/review/SKILL.md"), "utf8")).toBe("# review");
    expect(await fs.readFile(path.join(dir, "skills/review/scripts/run.sh"), "utf8")).toBe("echo hi");
    expect(warnings.some((w) => w.includes("instructions"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
    expect(warnings.some((w) => w.includes("memory"))).toBe(true);
  });

  it("warns and drops a cwd (no plugin-relative equivalent)", async () => {
    const b = emptyBundle();
    b.mcpServers = [
      { name: "local", transport: "stdio", command: "node", cwd: "/home/me/tools" },
    ];
    const warnings = await writePlugin(b, dir, "p");
    const mcp = JSON.parse(await fs.readFile(path.join(dir, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(mcp.mcpServers.local.cwd).toBeUndefined();
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
  });

  it("round-trips mcp + skills through a plugin directory", async () => {
    await writePlugin(bundle(), dir, "my-agent");
    expect(await isPluginDir(dir)).toBe(true);
    const { bundle: back, warnings } = await readPlugin(dir);
    expect(warnings).toEqual([]);
    expect(back.mcpServers).toEqual([
      {
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: { FS_API_KEY: "${FS_API_KEY}" },
        cwd: undefined,
      },
      {
        name: "api",
        transport: "http",
        url: "https://mcp.example.com/mcp",
        headers: { Authorization: "Bearer ${API_TOKEN}" },
      },
      {
        name: "legacy",
        transport: "sse",
        url: "https://sse.example.com/mcp",
        headers: undefined,
      },
    ]);
    expect(back.skills).toEqual(bundle().skills);
    expect(back.instructions).toBeUndefined();
    expect(back.memory).toEqual([]);
  });

  it("drops entries without an explicit type and reports them", async () => {
    await fs.writeFile(
      path.join(dir, "plugin.json"),
      JSON.stringify({ $schema: PLUGIN_SCHEMA, name: "p" }),
    );
    await fs.writeFile(
      path.join(dir, "mcp.json"),
      JSON.stringify({
        $schema: PLUGIN_MCP_SCHEMA,
        mcpServers: {
          untyped: { command: "node" },
          weird: { type: "websocket", url: "wss://x" },
          ok: { type: "stdio", command: "node" },
        },
      }),
    );
    const { bundle: back, warnings } = await readPlugin(dir);
    expect(back.mcpServers.map((s) => s.name)).toEqual(["ok"]);
    expect(warnings.some((w) => w.includes("untyped"))).toBe(true);
    expect(warnings.some((w) => w.includes("websocket"))).toBe(true);
  });

  it("rejects a directory without plugin.json", async () => {
    expect(await isPluginDir(dir)).toBe(false);
    await expect(readPlugin(dir)).rejects.toThrow(CliError);
  });
});
