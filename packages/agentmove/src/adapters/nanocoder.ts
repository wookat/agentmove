import path from "node:path";
import {
  AgentDef,
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
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planAgents, touchesMcpConfig } from "./shared.js";

/**
 * Nanocoder (Nano Collective). Global MCP servers live under the `mcpServers`
 * key of ~/.config/nanocoder/.mcp.json; each entry carries an explicit
 * `transport` ("stdio", "http", or "websocket"), stdio uses command/args/env,
 * http uses url/headers, and the typed schema includes an `enabled` boolean.
 * Instructions (AGENTS.md) load from the project root only, and nanocoder
 * skills use their own skill.yaml bundle format rather than the Agent Skills
 * standard, so both stay project-/client-specific at user scope.
 *
 * Custom slash commands are markdown files under ~/.config/nanocoder/commands/
 * (personal) and .nanocoder/commands/ (project, which wins on name conflicts);
 * subdirectories become `:`-separated namespaces, so nested layouts are
 * preserved. A directory containing <dirname>.md is a directory-as-command
 * bundle whose optional resources/ files are client-specific.
 */
const MCP_REL = ".config/nanocoder/.mcp.json";
const COMMANDS_DIR_REL = ".config/nanocoder/commands";

export const NANOCODER_COMMANDS_WARNING =
  "commands: frontmatter fields (description/aliases/triggers/tags) and {{parameter}} placeholders are client-specific and copied as-is; review after import";

/**
 * Read a nanocoder commands tree. Subdirectories are namespaces unless they
 * contain <dirname>.md, in which case the directory is a single command whose
 * markdown is exported (resources/ files are not portable and warned).
 */
export async function readNanocoderCommandsDir(
  root: string,
  warnings: string[],
  prefix = "",
): Promise<AgentDef[]> {
  if (!(await isDir(root))) return [];
  const out: AgentDef[] = [];
  for (const entry of (await listDir(root)).sort()) {
    if (entry.startsWith(".")) continue;
    const full = path.join(root, entry);
    if (await isDir(full)) {
      const bundleFile = path.join(full, `${entry}.md`);
      if (await exists(bundleFile)) {
        const content = await readText(bundleFile);
        if (content !== undefined) {
          out.push({ name: `${prefix}${entry}`, content });
        }
        if (await isDir(path.join(full, "resources"))) {
          warnings.push(
            `commands:${prefix}${entry}: nanocoder resources/ files are client-specific; only the command markdown is migrated`,
          );
        }
      } else {
        out.push(...(await readNanocoderCommandsDir(full, warnings, `${prefix}${entry}/`)));
      }
    } else if (entry.endsWith(".md")) {
      const content = await readText(full);
      if (content !== undefined) {
        out.push({ name: `${prefix}${entry.slice(0, -3)}`, content });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const CLIENT_KEYS = ["timeout", "alwaysAllow", "description", "tags"] as const;

export async function readNanocoderMcp(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseNanocoderServers(
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
    if (entry.transport === "websocket") {
      warnings.push(`mcp:${name}: nanocoder websocket transport has no portable equivalent; skipped`);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const command = typeof entry.command === "string" ? entry.command : undefined;
    let transport: Transport;
    if (entry.transport === "stdio" || entry.transport === "http") {
      transport = entry.transport;
    } else if (url) {
      transport = "http";
    } else {
      transport = "stdio";
    }
    if (transport === "stdio" && !command) {
      warnings.push(`mcp:${name}: stdio server without a command; dropped`);
      continue;
    }
    if (transport === "http" && !url) {
      warnings.push(`mcp:${name}: remote server without a url; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (entry[key] !== undefined) {
        warnings.push(`mcp:${name}: nanocoder ${key} setting is client-specific; not migrated`);
      }
    }
    servers.push({
      name,
      transport,
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
      enabled: entry.enabled === false ? false : undefined,
    });
  }
  return servers;
}

export function renderNanocoderServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      entry.transport = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: nanocoder does not support cwd; dropped`);
    } else {
      if (s.transport === "sse") {
        warnings.push(`mcp:${s.name}: nanocoder has no sse transport; emitted as http`);
      }
      entry.transport = "http";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) entry.enabled = false;
    out[s.name] = entry;
  }
  return out;
}

export async function planNanocoderMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readNanocoderMcp(file);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(
    existing,
    renderNanocoderServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const nanocoder: ClientAdapter = {
  id: "nanocoder",
  label: "Nanocoder",
  defaultPath: "~/.config/nanocoder (.mcp.json + commands/)",
  supportsCommands: true,

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".config/nanocoder")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "nanocoder";

    const config = await readNanocoderMcp(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseNanocoderServers(config, warnings);
    bundle.commands = await readNanocoderCommandsDir(
      path.join(home, COMMANDS_DIR_REL),
      warnings,
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planNanocoderMcp(
        bundle,
        path.join(home, MCP_REL),
        MCP_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    if (bundle.instructions) {
      warnings.push(
        "instructions: nanocoder reads AGENTS.md from the project root only; use --project",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: nanocoder has no persona file; skipped (use --project for AGENTS.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: nanocoder has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push(
        "skills: nanocoder skills use their own skill.yaml bundle format, not the Agent Skills standard; skipped",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_DIR_REL, ".md"));
      warnings.push(NANOCODER_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};
