import { promises as fs } from "node:fs";
import path from "node:path";
import {
  Bundle,
  CliError,
  emptyBundle,
  EXIT_DATA,
  isRecord,
  McpServer,
  parseFile,
  Skill,
  stringArgs,
  asStringRecord,
} from "./model.js";
import { exists, readText } from "./fsutil.js";
import { readSkillsDir } from "./adapters/shared.js";

/**
 * Agent Plugins 1.0.0 (agent-plugins.org): a portable plugin is a directory with
 * plugin.json, optional skills/ (Agent Skills standard), and optional mcp.json
 * whose entries carry an explicit type (stdio | streamable-http | sse).
 */
export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const PLUGIN_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

export async function isPluginDir(dir: string): Promise<boolean> {
  return exists(path.join(dir, "plugin.json"));
}

export async function isMcpJsonFile(file: string): Promise<boolean> {
  if (!file.endsWith(".json")) return false;
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function writePlugin(bundle: Bundle, dir: string, name: string): Promise<string[]> {
  const warnings: string[] = [];
  await fs.mkdir(dir, { recursive: true });

  const manifest: Record<string, unknown> = {
    $schema: PLUGIN_SCHEMA,
    name,
    description: `Exported by agentmove${bundle.manifest.exportedFrom ? ` from ${bundle.manifest.exportedFrom}` : ""}`,
  };
  await fs.writeFile(path.join(dir, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

  const mcpServers: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      if (!s.command) {
        warnings.push(`mcp:${s.name}: stdio server without a command; skipped in plugin mcp.json`);
        continue;
      }
      entry.type = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) {
        warnings.push(
          `mcp:${s.name}: cwd "${s.cwd}" dropped — Agent Plugins only allows plugin-relative or \${PLUGIN_ROOT}/\${PLUGIN_DATA} working directories`,
        );
      }
    } else {
      if (!s.url) {
        warnings.push(`mcp:${s.name}: remote server without a url; skipped in plugin mcp.json`);
        continue;
      }
      entry.type = s.transport === "sse" ? "sse" : "streamable-http";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: Agent Plugins has no disabled flag; exported as enabled`);
    }
    mcpServers[s.name] = entry;
  }
  if (Object.keys(mcpServers).length) {
    await fs.writeFile(
      path.join(dir, "mcp.json"),
      JSON.stringify({ $schema: PLUGIN_MCP_SCHEMA, mcpServers }, null, 2) + "\n",
    );
  }

  for (const skill of bundle.skills) {
    for (const [rel, content] of Object.entries(skill.files)) {
      const file = path.join(dir, "skills", skill.name, rel);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    }
  }

  if (bundle.instructions !== undefined) {
    warnings.push("instructions: Agent Plugins has no instructions component; not written");
  }
  if (bundle.persona !== undefined) {
    warnings.push("persona: Agent Plugins has no persona component; not written");
  }
  if (bundle.memory.length) {
    warnings.push("memory: Agent Plugins has no memory component; not written (consider --mif)");
  }
  return warnings;
}

export async function readPlugin(
  dir: string,
): Promise<{ bundle: Bundle; warnings: string[] }> {
  const warnings: string[] = [];
  const bundle = emptyBundle();

  const manifestFile = path.join(dir, "plugin.json");
  const manifestRaw = await readText(manifestFile);
  if (manifestRaw === undefined) {
    throw new CliError(`${dir}: not an Agent Plugin (missing plugin.json)`, EXIT_DATA);
  }
  const manifest = parseFile<unknown>(manifestFile, manifestRaw, JSON.parse);
  if (!isRecord(manifest) || typeof manifest.name !== "string") {
    throw new CliError(`${manifestFile}: invalid plugin manifest (missing name)`, EXIT_DATA);
  }
  if (manifest.$schema !== PLUGIN_SCHEMA) {
    warnings.push(
      `plugin.json: unrecognized $schema (expected ${PLUGIN_SCHEMA}); reading as Agent Plugins 1.0.0`,
    );
  }

  const mcpFile = path.join(dir, "mcp.json");
  const mcpRaw = await readText(mcpFile);
  if (mcpRaw !== undefined) {
    const data = parseFile<unknown>(mcpFile, mcpRaw, JSON.parse);
    const serversObj = isRecord(data) && isRecord(data.mcpServers) ? data.mcpServers : {};
    bundle.mcpServers = parseMcpEntries(serversObj, warnings, { inferType: false });
  }

  const skills: Skill[] = await readSkillsDir(path.join(dir, "skills"), warnings);
  bundle.skills = skills;
  return { bundle, warnings };
}

function parseMcpEntries(
  serversObj: Record<string, unknown>,
  warnings: string[],
  opts: { inferType: boolean },
): McpServer[] {
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (!isRecord(entry)) {
      warnings.push(`mcp:${name}: entry is not an object; dropped`);
      continue;
    }
    let type = typeof entry.type === "string" ? entry.type : undefined;
    if (type === undefined && opts.inferType && typeof entry.transport === "string") {
      type = entry.transport;
    }
    if (type === undefined && opts.inferType) {
      if (typeof entry.command === "string") type = "stdio";
      else if (typeof entry.url === "string") type = "streamable-http";
      if (type !== undefined) {
        warnings.push(`mcp:${name}: no explicit type; inferred ${type === "stdio" ? "stdio from command" : "streamable-http from url"}`);
      }
    }
    if (type === undefined) {
      warnings.push(`mcp:${name}: entry missing the required explicit type; dropped`);
      continue;
    }
    if (type === "stdio") {
      if (typeof entry.command !== "string") {
        warnings.push(`mcp:${name}: stdio entry missing command; dropped`);
        continue;
      }
      servers.push({
        name,
        transport: "stdio",
        command: entry.command,
        args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
        env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
        cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      });
    } else if (
      type === "streamable-http" ||
      type === "sse" ||
      (opts.inferType && (type === "http" || type === "streamable_http" || type === "streamable"))
    ) {
      if (typeof entry.url !== "string") {
        warnings.push(`mcp:${name}: ${type} entry missing url; dropped`);
        continue;
      }
      servers.push({
        name,
        transport: type === "sse" ? "sse" : "http",
        url: entry.url,
        headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
      });
    } else {
      warnings.push(`mcp:${name}: unknown type "${type}"; dropped`);
    }
  }
  return servers;
}

/**
 * Read a standalone MCP config file (an Agent Plugins mcp.json, or the common
 * `mcpServers` shape used by mcp.json/.mcp.json files across the ecosystem).
 * More lenient than a plugin's mcp.json: the transport may be given as `type`
 * or `transport`, and is inferred from `command`/`url` (with a warning) when
 * omitted, since many clients' files carry no explicit type.
 */
export async function readMcpFile(
  file: string,
): Promise<{ bundle: Bundle; warnings: string[] }> {
  const warnings: string[] = [];
  const bundle = emptyBundle();
  const raw = await readText(file);
  if (raw === undefined) {
    throw new CliError(`${file}: cannot read MCP config file`, EXIT_DATA);
  }
  const data = parseFile<unknown>(file, raw, JSON.parse);
  if (!isRecord(data) || !isRecord(data.mcpServers)) {
    throw new CliError(`${file}: not an MCP config file (missing mcpServers)`, EXIT_DATA);
  }
  bundle.mcpServers = parseMcpEntries(data.mcpServers, warnings, { inferType: true });
  return { bundle, warnings };
}
