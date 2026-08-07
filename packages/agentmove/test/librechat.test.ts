import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { librechat } from "../src/adapters/librechat.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

interface LibrechatConfig {
  version?: string;
  mcpServers?: Record<string, Record<string, unknown>>;
}

const SAMPLE_YAML = `version: 1.2.8
cache: true
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - '@modelcontextprotocol/server-filesystem'
      - /tmp
    env:
      FS_API_KEY: test-not-a-real-token
    timeout: 30000
  api-server:
    type: streamable-http
    url: https://mcp.example.com/mcp
    headers:
      Authorization: Bearer test-not-a-real-token
  events:
    url: https://sse.example.com/sse
  sockets:
    type: websocket
    url: wss://ws.example.com
`;

async function mkProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-librechat-"));
  await fs.writeFile(path.join(dir, "librechat.yaml"), SAMPLE_YAML);
  return dir;
}

describe("librechat adapter", () => {
  it("user scope is warnings-only and points at --project", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-librechat-home-"));
    const { bundle, warnings } = await librechat.exportBundle(home);
    expect(bundle.mcpServers).toEqual([]);
    expect(warnings.some((w) => w.includes("--project"))).toBe(true);

    const imported = emptyBundle();
    imported.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    imported.instructions = "Rules.";
    imported.persona = "You are helpful.";
    imported.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    imported.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const res = await librechat.planImport(imported, home, {});
    expect(res.files).toEqual([]);
    expect(res.warnings.some((w) => w.includes("--project"))).toBe(true);
    expect(res.warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(res.warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(res.warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(res.warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });

  it("project export parses stdio, streamable-http, default-sse, and skips websocket", async () => {
    const dir = await mkProject();
    const adapter = getProjectAdapter("librechat");
    const { bundle, warnings } = await adapter.exportProject(dir);
    const names = bundle.mcpServers.map((s) => s.name).sort();
    expect(names).toEqual(["api-server", "events", "filesystem"]);

    const fsrv = bundle.mcpServers.find((s) => s.name === "filesystem")!;
    expect(fsrv.transport).toBe("stdio");
    expect(fsrv.command).toBe("npx");
    expect(fsrv.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });

    const api = bundle.mcpServers.find((s) => s.name === "api-server")!;
    expect(api.transport).toBe("http");
    expect(api.url).toBe("https://mcp.example.com/mcp");

    const events = bundle.mcpServers.find((s) => s.name === "events")!;
    expect(events.transport).toBe("sse");

    expect(warnings.some((w) => w.includes("mcp:sockets") && w.includes("websocket"))).toBe(true);
    expect(warnings.some((w) => w.includes("timeout setting is client-specific"))).toBe(true);
  });

  it("project import merges by name, preserves other yaml keys, and warns", async () => {
    const dir = await mkProject();
    const adapter = getProjectAdapter("librechat");
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/x" },
      { name: "remote", transport: "http", url: "https://h.example.com/mcp" },
      { name: "stream", transport: "sse", url: "https://s.example.com/sse", enabled: false },
    ];
    bundle.instructions = "Rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    expect(files.map((f) => f.path)).toEqual(["librechat.yaml"]);
    const config = parseYaml(files[0]!.content) as LibrechatConfig;
    expect(config.version).toBe("1.2.8");
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
      "sockets",
      "stream",
    ]);
    expect(config.mcpServers!.filesystem!.timeout).toBe(30000);
    expect(config.mcpServers!.docs).toEqual({ type: "stdio", command: "npx", args: ["docs-mcp"] });
    expect(config.mcpServers!.remote).toEqual({
      type: "streamable-http",
      url: "https://h.example.com/mcp",
    });
    expect(config.mcpServers!.stream).toEqual({ type: "sse", url: "https://s.example.com/sse" });
    expect(warnings.some((w) => w.includes("does not support cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("YAML comments"))).toBe(false);
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });

  it("project import supports --replace-mcp and warns about comments", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-librechat-"));
    await fs.writeFile(
      path.join(dir, "librechat.yaml"),
      "# deployment config\nmcpServers:\n  existing:\n    command: node\n",
    );
    const adapter = getProjectAdapter("librechat");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const { files, warnings } = await adapter.planImport(bundle, dir, { replaceMcp: true });
    const config = parseYaml(files[0]!.content) as LibrechatConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["only"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
    expect(warnings.some((w) => w.includes("YAML comments are not preserved"))).toBe(true);
  });
});
