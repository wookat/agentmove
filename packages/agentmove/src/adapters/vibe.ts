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
import { appendSections, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

/**
 * Vibe Code CLI (Mistral). MCP servers live in `[[mcp_servers]]` array-of-table
 * entries of ~/.vibe/config.toml; each entry carries its own `name` plus an
 * explicit `transport` ("stdio", "http", or "streamable-http"). Instructions
 * load from ~/.vibe/AGENTS.md and skills follow the Agent Skills standard
 * under ~/.vibe/skills/.
 */
const CONFIG_REL = ".vibe/config.toml";
const AGENTS_REL = ".vibe/AGENTS.md";
const SKILLS_REL = ".vibe/skills";

const CLIENT_KEYS = [
  "api_key_env",
  "api_key_header",
  "api_key_format",
  "startup_timeout_sec",
  "tool_timeout_sec",
  "enabled_tools",
  "disabled_tools",
] as const;

export async function readVibeConfig(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseToml);
  return isRecord(data) ? data : {};
}

export function parseVibeServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const list = Array.isArray(config.mcp_servers) ? config.mcp_servers : [];
  const servers: McpServer[] = [];
  for (const rawEntry of list) {
    if (!isRecord(rawEntry) || typeof rawEntry.name !== "string") {
      warnings.push("mcp: vibe entry without a name; dropped");
      continue;
    }
    const name = rawEntry.name;
    const url = typeof rawEntry.url === "string" ? rawEntry.url : undefined;
    const command = typeof rawEntry.command === "string" ? rawEntry.command : undefined;
    if (!url && !command) {
      warnings.push(`mcp:${name}: neither command nor url; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (rawEntry[key] !== undefined) {
        warnings.push(`mcp:${name}: vibe ${key} setting is client-specific; not migrated`);
      }
    }
    servers.push({
      name,
      transport: url ? "http" : "stdio",
      command,
      args: stringArgs(rawEntry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(rawEntry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(rawEntry.headers, `mcp:${name}.headers`, warnings),
    });
  }
  return servers;
}

export function renderVibeServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = { name: s.name };
    if (s.transport === "stdio") {
      entry.transport = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: vibe does not document cwd; dropped`);
    } else {
      if (s.transport === "sse") {
        warnings.push(`mcp:${s.name}: vibe has no sse transport; emitted as http`);
      }
      entry.transport = "http";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: vibe has no per-server disabled flag; server emitted as enabled`);
    }
    out.push(entry);
  }
  return out;
}

/** Merge imported entries into the existing name-keyed array of tables. */
export function mergeVibeServers(
  existing: unknown,
  imported: Record<string, unknown>[],
  warnings: string[],
  replace: boolean,
): Record<string, unknown>[] {
  const existingList = (Array.isArray(existing) ? existing : []).filter(isRecord);
  if (replace) {
    const importedNames = new Set(imported.map((e) => e.name));
    for (const e of existingList) {
      if (typeof e.name === "string" && !importedNames.has(e.name)) {
        warnings.push(`mcp:${e.name}: removed by --replace-mcp`);
      }
    }
    return imported;
  }
  const out = [...existingList];
  for (const entry of imported) {
    const idx = out.findIndex((e) => e.name === entry.name);
    if (idx >= 0) {
      if (JSON.stringify(out[idx]) !== JSON.stringify(entry)) {
        warnings.push(`mcp:${String(entry.name)}: existing server with the same name overwritten by import`);
      }
      out[idx] = entry;
    } else {
      out.push(entry);
    }
  }
  return out;
}

export async function planVibeMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readVibeConfig(file);
  config.mcp_servers = mergeVibeServers(
    config.mcp_servers,
    renderVibeServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: stringifyToml(config) + "\n" });
  }
  return files;
}

export const vibe: ClientAdapter = {
  id: "vibe",
  label: "Vibe Code CLI",
  defaultPath: "~/.vibe (config.toml + AGENTS.md + skills/)",

  async detect(home) {
    return isDir(path.join(home, ".vibe"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "vibe";

    const config = await readVibeConfig(path.join(home, CONFIG_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseVibeServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planVibeMcp(
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
        "persona: vibe has no persona file; appended to ~/.vibe/AGENTS.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: vibe has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
