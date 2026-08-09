import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
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
  Skill,
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
 * Global rules load from markdown files in ~/.grok/ (AGENTS.md standard).
 * User skills follow the Agent Skills standard under ~/.agents/skills/
 * (grok never loads ~/.grok/skills/; that root is only read for compatibility
 * with skills written there by older agentmove versions).
 * Custom foreground sub-agents are `subAgents` entries ({name, model,
 * instruction}) in ~/.grok/user-settings.json, invoked by exact name via the
 * task tool and managed with /agents in the TUI.
 */
const CONFIG_REL = ".grok/config.toml";
const AGENTS_REL = ".grok/AGENTS.md";
const SKILLS_REL = ".agents/skills";
const LEGACY_SKILLS_REL = ".grok/skills";
const USER_SETTINGS_REL = ".grok/user-settings.json";

/** Sub-agent names grok reserves for built-ins; custom entries with these names are ignored. */
const RESERVED_SUBAGENT_NAMES = new Set([
  "general",
  "explore",
  "vision",
  "verify",
  "verify-detect",
  "verify-manifest",
  "computer",
]);

/** Grok requires a valid model id on every subAgents entry; imports use the grok default. */
const IMPORT_MODEL = "grok-4.3";

export const GROK_AGENTS_EXPORT_WARNING =
  "agents: converted from grok subAgents entries in user-settings.json (instruction only); the per-agent model is dropped with a warning";

export const GROK_AGENTS_IMPORT_WARNING = `agents: written as subAgents entries in ~/.grok/user-settings.json with model "${IMPORT_MODEL}"; adjust the model per agent with /agents or in user-settings.json`;

/** Read Agent Skills from ~/.agents/skills plus the legacy ~/.grok/skills root. */
export async function readGrokSkills(
  preferredRoot: string,
  legacyRoot: string,
  warnings: string[],
): Promise<Skill[]> {
  const skills = await readSkillsDir(preferredRoot, warnings);
  const names = new Set(skills.map((s) => s.name));
  for (const skill of await readSkillsDir(legacyRoot, warnings)) {
    if (names.has(skill.name)) {
      warnings.push(
        `skills:${skill.name}: legacy .grok/skills copy shadowed by .agents/skills; the .agents/skills version is exported`,
      );
      continue;
    }
    warnings.push(
      `skills:${skill.name}: read from .grok/skills, which grok does not load; imports write .agents/skills`,
    );
    names.add(skill.name);
    skills.push(skill);
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

/** Read custom sub-agents from the `subAgents` list of user-settings.json. */
export async function readGrokAgents(file: string, warnings: string[]): Promise<AgentDef[]> {
  const raw = await readText(file);
  if (raw === undefined) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    warnings.push("agents: user-settings.json is invalid JSON; sub-agents not migrated");
    return [];
  }
  if (!isRecord(data) || data.subAgents === undefined) return [];
  if (!Array.isArray(data.subAgents)) {
    warnings.push("agents: subAgents is not a list; not migrated");
    return [];
  }
  const agents: AgentDef[] = [];
  const seen = new Set<string>();
  for (const item of data.subAgents) {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.trim() === "") {
      warnings.push("agents: subAgents entry without a name; grok ignores it; not migrated");
      continue;
    }
    const name = item.name.trim();
    if (RESERVED_SUBAGENT_NAMES.has(name.toLowerCase())) {
      warnings.push(
        `agents:${name}: reserved built-in sub-agent name; grok ignores the entry; not migrated`,
      );
      continue;
    }
    if (seen.has(name.toLowerCase())) {
      warnings.push(
        `agents:${name}: duplicate sub-agent name; grok keeps the first entry; not migrated`,
      );
      continue;
    }
    const instruction = typeof item.instruction === "string" ? item.instruction : "";
    if (instruction.trim() === "") {
      warnings.push(`agents:${name}: sub-agent has no instruction; nothing portable; not migrated`);
      continue;
    }
    seen.add(name.toLowerCase());
    if (typeof item.model === "string" && item.model !== "") {
      warnings.push(
        `agents:${name}: grok per-agent model "${item.model}" has no portable equivalent; dropped`,
      );
    }
    agents.push({ name, content: instruction.endsWith("\n") ? instruction : instruction + "\n" });
  }
  return agents;
}

/** Merge portable agents into the `subAgents` list of user-settings.json. */
export async function planGrokAgents(
  agents: AgentDef[],
  file: string,
  rel: string,
  warnings: string[],
): Promise<FilePlan[]> {
  const raw = await readText(file);
  let settings: Record<string, unknown> = {};
  if (raw !== undefined) {
    const data = parseFile<unknown>(file, raw, JSON.parse);
    if (isRecord(data)) settings = data;
  }
  const existing = Array.isArray(settings.subAgents) ? [...settings.subAgents] : [];
  const indexByName = new Map<string, number>();
  for (const [i, item] of existing.entries()) {
    if (isRecord(item) && typeof item.name === "string") {
      indexByName.set(item.name.trim().toLowerCase(), i);
    }
  }
  const used = new Set<string>();
  for (const a of agents) {
    let name = a.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(`agents:${a.name}: grok sub-agent names are plain strings; imported as ${name}`);
    }
    if (RESERVED_SUBAGENT_NAMES.has(name.toLowerCase())) {
      warnings.push(
        `agents:${a.name}: name is reserved for a grok built-in sub-agent; grok would ignore it; skipped`,
      );
      continue;
    }
    if (used.has(name.toLowerCase())) {
      warnings.push(`agents:${a.name}: name collides with another agent after flattening; skipped`);
      continue;
    }
    used.add(name.toLowerCase());
    if (/^---\n[\s\S]*?\n---\n?/.test(a.content)) {
      warnings.push(
        `agents:${name}: grok sub-agents have no metadata fields; frontmatter kept verbatim inside the instruction`,
      );
    }
    const entry = { name, model: IMPORT_MODEL, instruction: a.content };
    const existingIndex = indexByName.get(name.toLowerCase());
    if (existingIndex !== undefined) {
      warnings.push(`agents:${name}: overwrites the existing sub-agent with the same name`);
      existing[existingIndex] = entry;
    } else {
      indexByName.set(name.toLowerCase(), existing.length);
      existing.push(entry);
    }
  }
  settings.subAgents = existing;
  return [{ path: rel, content: JSON.stringify(settings, null, 2) + "\n" }];
}

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
  defaultPath: "~/.grok (config.toml + AGENTS.md + user-settings.json) + ~/.agents/skills",
  supportsAgents: true,

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
    bundle.skills = await readGrokSkills(
      path.join(home, SKILLS_REL),
      path.join(home, LEGACY_SKILLS_REL),
      warnings,
    );
    bundle.agents = await readGrokAgents(path.join(home, USER_SETTINGS_REL), warnings);
    if (bundle.agents.length) warnings.push(GROK_AGENTS_EXPORT_WARNING);
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
    if (bundle.agents.length) {
      files.push(
        ...(await planGrokAgents(
          bundle.agents,
          path.join(home, USER_SETTINGS_REL),
          USER_SETTINGS_REL,
          warnings,
        )),
      );
      warnings.push(GROK_AGENTS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};
