import path from "node:path";
import {
  Bundle,
  ClientAdapter,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
} from "../model.js";
import { isDir, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Muse Code (Meta's terminal coding agent, built on Muse Spark). User settings
 * live in ~/.config/muse/settings.json (must carry `"schema_version": 1`);
 * MCP servers sit under its `mcp_servers` key, each entry with an explicit
 * `transport`: "stdio" (command/args/env) or "streamable_http" (url/headers),
 * plus a native `enabled` flag and client-specific `mode`/`framing` fields.
 * User skills follow the Agent Skills standard under ~/.config/muse/skills/
 * (Muse also reads the shared ~/.agents/skills/). Project context lives in the
 * repo: AGENTS.md rules, .agents/skills/, and .agents/memory/ durable memory.
 */
const CONFIG_DIR_REL = ".config/muse";
const SETTINGS_REL = ".config/muse/settings.json";
const SKILLS_REL = ".config/muse/skills";

export async function readMuseSettings(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

/** Normalize a Muse entry into the common shape parseCommonMcpEntry understands. */
export function fromMuseEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out: Record<string, unknown> = { ...entry };
  if (out.transport === "streamable_http") out.type = "http";
  else if (out.transport === "stdio") out.type = "stdio";
  delete out.transport;
  return out;
}

/** Render a portable server into Muse's settings.json spelling. */
export function toMuseEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.transport === "stdio") {
    out.transport = "stdio";
    out.command = s.command;
    if (s.args?.length) out.args = s.args;
    if (s.env && Object.keys(s.env).length) out.env = s.env;
    if (s.cwd) {
      warnings.push(`mcp:${s.name}: muse settings.json has no cwd field; dropped`);
    }
  } else {
    if (s.transport === "sse") {
      warnings.push(`mcp:${s.name}: muse has no SSE transport; written as streamable_http`);
    }
    out.transport = "streamable_http";
    out.url = s.url;
    if (s.headers && Object.keys(s.headers).length) out.headers = s.headers;
  }
  if (s.enabled === false) out.enabled = false;
  return out;
}

export function parseMuseServers(
  settings: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(settings.mcp_servers) ? settings.mcp_servers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, fromMuseEntry(entry), warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.enabled === false) s.enabled = false;
      if (entry.mode !== undefined) {
        warnings.push(`mcp:${name}: muse mode (required/optional) is client-specific; not migrated`);
      }
      if (entry.framing !== undefined) {
        warnings.push(`mcp:${name}: muse framing is client-specific; not migrated`);
      }
    }
    servers.push(s);
  }
  return servers;
}

export async function planMuseMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const settings = await readMuseSettings(file);
  const rendered: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    rendered[s.name] = toMuseEntry(s, warnings);
  }
  const existing = isRecord(settings.mcp_servers) ? settings.mcp_servers : {};
  const merged = mergeMcpRecords(existing, rendered, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    // Muse refuses to start on a settings file without schema_version: 1.
    const out: Record<string, unknown> = { schema_version: 1, ...settings, mcp_servers: merged };
    files.push({ path: rel, content: JSON.stringify(out, null, 2) + "\n" });
  }
  return files;
}

export const muse: ClientAdapter = {
  id: "muse",
  label: "Muse Code",
  defaultPath: "~/.config/muse (settings.json mcp_servers + skills/)",

  async detect(home) {
    return isDir(path.join(home, CONFIG_DIR_REL));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "muse";

    const settings = await readMuseSettings(path.join(home, SETTINGS_REL));
    bundle.config.raw = settings;
    bundle.mcpServers = parseMuseServers(settings, warnings);
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    warnings.push(
      "instructions: muse machine-wide user rules and personal memory are app-managed; " +
        "project AGENTS.md/.agents memory migrate with --project",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planMuseMcp(
        bundle,
        path.join(home, SETTINGS_REL),
        SETTINGS_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    if (bundle.instructions || bundle.persona) {
      warnings.push(
        "instructions/persona: muse has no documented machine-wide rules file; " +
          "skipped (use --project to write AGENTS.md)",
      );
    }
    if (bundle.memory.length) {
      warnings.push(
        "memory: muse personal memory is app-managed; skipped " +
          "(use --project for .agents/memory, or --mif)",
      );
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
