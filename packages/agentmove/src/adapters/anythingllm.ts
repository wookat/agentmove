import path from "node:path";
import {
  asStringRecord,
  Bundle,
  ClientAdapter,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
  stringArgs,
  Transport,
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import { mergeMcpRecords, touchesMcpConfig } from "./shared.js";

/**
 * AnythingLLM (Mintplex-Labs/anything-llm) desktop app. The migratable
 * surface is the storage plugins file anythingllm_mcp_servers.json: an
 * `mcpServers` map where stdio entries use command/args/env and remote
 * entries use url/headers plus an optional `type` — "sse", "streamable", or
 * "http" ("streamable"/"http" mean Streamable HTTP; when `type` is omitted
 * on a url entry the app defaults to SSE). A nested `anythingllm` block
 * carries app settings: `autoStart: false` skips booting the server (mapped
 * to portable enabled:false) and `suppressedTools` is client-specific.
 * Workspaces, system prompts, and chat history are app-managed (database).
 * Default Linux desktop storage: ~/.config/anythingllm-desktop/storage.
 */
const MCP_REL = ".config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json";

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseAnythingLlmServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (!isRecord(entry)) {
      warnings.push(`mcp:${name}: entry is not an object; dropped`);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const command = typeof entry.command === "string" ? entry.command : undefined;
    let transport: Transport;
    if (url) {
      // "streamable"/"http" mean Streamable HTTP; omitted type defaults to SSE.
      transport = entry.type === "streamable" || entry.type === "http" ? "http" : "sse";
    } else {
      transport = "stdio";
    }
    if (transport === "stdio" && !command) {
      warnings.push(`mcp:${name}: stdio server without a command; dropped`);
      continue;
    }
    const app = isRecord(entry.anythingllm) ? entry.anythingllm : undefined;
    if (app && Array.isArray(app.suppressedTools) && app.suppressedTools.length) {
      warnings.push(
        `mcp:${name}: anythingllm suppressedTools setting is client-specific; not migrated`,
      );
    }
    servers.push({
      name,
      transport,
      command: transport === "stdio" ? command : undefined,
      args:
        transport === "stdio" ? stringArgs(entry.args, `mcp:${name}.args`, warnings) : undefined,
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
      enabled: app?.autoStart === false ? false : undefined,
    });
  }
  return servers;
}

export function renderAnythingLlmServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: anythingllm does not support cwd; dropped`);
    } else {
      // "streamable" selects Streamable HTTP; "sse" (or no type) selects SSE.
      entry.type = s.transport === "http" ? "streamable" : "sse";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) entry.anythingllm = { autoStart: false };
    out[s.name] = entry;
  }
  return out;
}

export const anythingllm: ClientAdapter = {
  id: "anythingllm",
  label: "AnythingLLM",
  defaultPath: "~/.config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".config/anythingllm-desktop")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "anythingllm";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseAnythingLlmServers(config, warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAnythingLlmServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: anythingllm system prompts are app-managed per workspace (database); skipped",
      );
    }
    if (bundle.persona) warnings.push("persona: anythingllm has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: anythingllm has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: anythingllm has no SKILL.md mechanism; skipped");
    }
    return { files, warnings };
  },
};
