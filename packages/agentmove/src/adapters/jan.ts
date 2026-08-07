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
 * Jan (janhq/jan), local-first LLM desktop app. The only migratable surface
 * is the Jan data folder's mcp_config.json: an `mcpServers` map where every
 * entry carries `command` and `args` (empty for remote servers), remote
 * entries add `type` ("http" or "sse") plus url/headers, and `active: false`
 * marks a server as not running. `mcpSettings` and other top-level keys are
 * app-managed and preserved verbatim. The default data folder is
 * ~/.local/share/Jan/data on Linux (platform data dir elsewhere) and can be
 * relocated in Settings > General.
 */
const MCP_REL = ".local/share/Jan/data/mcp_config.json";

const CLIENT_KEYS = ["timeout", "official"] as const;

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseJanServers(
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
    if ((entry.type === "http" || entry.type === "sse") && url) {
      transport = entry.type;
    } else if (url) {
      transport = "http";
    } else {
      transport = "stdio";
    }
    if (transport === "stdio" && !command) {
      warnings.push(`mcp:${name}: stdio server without a command; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (entry[key] !== undefined) {
        warnings.push(`mcp:${name}: jan ${key} setting is client-specific; not migrated`);
      }
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
      enabled: entry.active === false ? false : undefined,
    });
  }
  return servers;
}

export function renderJanServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    // Jan's loader requires `command` and `args` keys on every entry,
    // including remote servers (written as empty values by the Jan UI).
    const entry: Record<string, unknown> = {
      command: s.transport === "stdio" ? s.command : "",
      args: s.transport === "stdio" ? (s.args ?? []) : [],
    };
    if (s.transport === "stdio") {
      entry.env = s.env ?? {};
      if (s.cwd) warnings.push(`mcp:${s.name}: jan does not support cwd; dropped`);
    } else {
      entry.type = s.transport;
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
      entry.env = {};
    }
    if (s.enabled === false) entry.active = false;
    out[s.name] = entry;
  }
  return out;
}

export const jan: ClientAdapter = {
  id: "jan",
  label: "Jan",
  defaultPath: "~/.local/share/Jan/data/mcp_config.json",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".local/share/Jan")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "jan";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseJanServers(config, warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderJanServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: jan assistant instructions are app-managed (assistants/*/assistant.json); skipped",
      );
    }
    if (bundle.persona) warnings.push("persona: jan has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: jan has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: jan has no SKILL.md mechanism; skipped");
    }
    return { files, warnings };
  },
};
