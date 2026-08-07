import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
import { exists, readText } from "../fsutil.js";
import { mergeMcpRecords, touchesMcpConfig } from "./shared.js";

/**
 * LibreChat (danny-avila/LibreChat), self-hosted AI chat platform. MCP
 * servers live in the deployment's librechat.yaml under `mcpServers`:
 * stdio entries use command/args/env, remote entries use url/headers with
 * `type` "sse", "streamable-http", or "websocket" (omitted type defaults by
 * url scheme — http(s) means SSE, ws(s) means websocket; command means
 * stdio). timeout/initTimeout/serverInstructions/iconPath/chatMenu/
 * customUserVars/requiresOAuth/oauth/proxy are client-specific. The file is
 * per-deployment, so everything is project-scoped (--project in the
 * LibreChat deployment directory); there is no user-scope surface — user
 * prompts, agents, and memory live in the app database.
 */
const CONFIG_REL = "librechat.yaml";

const CLIENT_KEYS = [
  "timeout",
  "initTimeout",
  "serverInstructions",
  "iconPath",
  "chatMenu",
  "customUserVars",
  "requiresOAuth",
  "oauth",
  "proxy",
] as const;

export async function readLibrechatConfig(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => parseYaml(s) as unknown);
  return isRecord(data) ? data : {};
}

export function parseLibrechatServers(
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
    if (entry.type === "websocket" || (entry.type === undefined && url && /^wss?:/.test(url))) {
      warnings.push(`mcp:${name}: websocket servers have no portable equivalent; skipped`);
      continue;
    } else if (entry.type === "streamable-http" || entry.type === "http") {
      transport = "http";
    } else if (entry.type === "sse" || (entry.type === undefined && url)) {
      transport = "sse";
    } else {
      transport = "stdio";
    }
    if (transport === "stdio" && !command) {
      warnings.push(`mcp:${name}: stdio server without a command; dropped`);
      continue;
    }
    if (transport !== "stdio" && !url) {
      warnings.push(`mcp:${name}: remote server without a url; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (entry[key] !== undefined) {
        warnings.push(`mcp:${name}: librechat ${key} setting is client-specific; not migrated`);
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
    });
  }
  return servers;
}

export function renderLibrechatServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      entry.type = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: librechat does not support cwd; dropped`);
    } else {
      entry.type = s.transport === "http" ? "streamable-http" : "sse";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: librechat has no disabled flag; server emitted as enabled`);
    }
    out[s.name] = entry;
  }
  return out;
}

export async function planLibrechatMcp(
  bundle: Bundle,
  configFile: string,
  configRel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const raw = await readText(configFile);
  const config = await readLibrechatConfig(configFile);
  if (raw !== undefined && raw.includes("#")) {
    warnings.push(`${configRel}: existing YAML comments are not preserved on rewrite`);
  }
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(
    existing,
    renderLibrechatServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: configRel, content: stringifyYaml(config) });
  }
  return files;
}

export const librechat: ClientAdapter = {
  id: "librechat",
  label: "LibreChat",
  defaultPath: "./librechat.yaml in the deployment directory (project-scoped: use --project)",

  async detect(home) {
    // librechat.yaml lives in the deployment directory; the official install
    // instructions clone the repo into $HOME, so probe the default location.
    return exists(path.join(home, "LibreChat", "librechat.yaml"));
  },

  async exportBundle(home): Promise<ExportResult> {
    void home;
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "librechat";
    warnings.push(
      "mcp: librechat.yaml is per-deployment; run with --project in the LibreChat deployment directory",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, _opts): Promise<ImportResult> {
    void home;
    const warnings: string[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: librechat.yaml is per-deployment; import with --project in the LibreChat deployment directory",
      );
    }
    if (bundle.instructions) {
      warnings.push("instructions: librechat custom prompts are app-managed (database); skipped");
    }
    if (bundle.persona) warnings.push("persona: librechat has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: librechat memory is app-managed (database); skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: librechat has no SKILL.md mechanism; skipped");
    }
    return { files: [], warnings };
  },
};

export { CONFIG_REL as LIBRECHAT_CONFIG_REL };
