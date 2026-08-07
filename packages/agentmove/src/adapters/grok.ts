import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
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
} from "../model.js";
import { isDir, readText } from "../fsutil.js";
import {
  appendSections,
  mergeMcpRecords,
  planSkills,
  readSkillsDir,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Grok CLI (xAI Grok Build). MCP servers live in `[mcp_servers.<name>]`
 * tables of ~/.grok/config.toml: stdio servers use command/args/env, remote
 * servers use url/headers; `${VAR}` references expand from the environment at
 * load time. `startup_timeout_sec`/`tool_timeout_sec` are client-specific.
 * Global rules load from markdown files in ~/.grok/ (AGENTS.md standard),
 * and user skills follow the Agent Skills standard under ~/.grok/skills/.
 */
const CONFIG_REL = ".grok/config.toml";
const AGENTS_REL = ".grok/AGENTS.md";
const SKILLS_REL = ".grok/skills";

export async function readGrokConfig(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseToml);
  return isRecord(data) ? data : {};
}

export function parseGrokServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcp_servers) ? config.mcp_servers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (!isRecord(entry)) {
      warnings.push(`mcp:${name}: entry is not a table; dropped`);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const command = typeof entry.command === "string" ? entry.command : undefined;
    if (!url && !command) {
      warnings.push(`mcp:${name}: neither command nor url; dropped`);
      continue;
    }
    if (entry.startup_timeout_sec !== undefined || entry.tool_timeout_sec !== undefined) {
      warnings.push(`mcp:${name}: grok timeout settings are client-specific; not migrated`);
    }
    servers.push({
      name,
      transport: url ? "http" : "stdio",
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
    });
  }
  return servers;
}

export function toGrokEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  if (s.transport === "stdio") {
    entry.command = s.command;
    if (s.args?.length) entry.args = s.args;
    if (s.env && Object.keys(s.env).length) entry.env = s.env;
    if (s.cwd) warnings.push(`mcp:${s.name}: grok does not document cwd; dropped`);
  } else {
    if (s.transport === "sse") {
      warnings.push(`mcp:${s.name}: grok has no documented sse transport; emitted as url`);
    }
    entry.url = s.url;
    if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
  }
  if (s.enabled === false) {
    warnings.push(
      `mcp:${s.name}: grok config.toml has no documented disabled flag; imported as enabled (use \`grok mcp disable\`)`,
    );
  }
  return entry;
}

export async function planGrokMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readGrokConfig(file);
  const rendered: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    rendered[s.name] = toGrokEntry(s, warnings);
  }
  const existing = isRecord(config.mcp_servers) ? config.mcp_servers : {};
  config.mcp_servers = mergeMcpRecords(existing, rendered, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: stringifyToml(config) + "\n" });
  }
  return files;
}

export const grok: ClientAdapter = {
  id: "grok",
  label: "Grok CLI",
  defaultPath: "~/.grok (config.toml + AGENTS.md + skills/)",

  async detect(home) {
    return isDir(path.join(home, ".grok"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "grok";

    const config = await readGrokConfig(path.join(home, CONFIG_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseGrokServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planGrokMcp(
        bundle,
        path.join(home, CONFIG_REL),
        CONFIG_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        "persona: grok has no persona file; appended to ~/.grok/AGENTS.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: grok has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
