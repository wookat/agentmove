import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  AgentDef,
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
import { exists, isDir, listDir, readText } from "../fsutil.js";
import {
  appendSections,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planCommandsFlat,
  planSkills,
  readAgentsDir,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Roo Code (VS Code extension). Global MCP servers live under the
 * `mcpServers` key of mcp_settings.json inside the extension's VS Code
 * globalStorage folder; remote servers require an explicit `type` of
 * "streamable-http" or "sse" (a bare `url` is an error in Roo). Global rules
 * are markdown files under ~/.roo/rules/; skills follow the Agent Skills
 * standard under ~/.roo/skills/. Custom slash commands are markdown files
 * under ~/.roo/commands/ (global) and .roo/commands/ (project); the flat
 * filename becomes the /name, and project commands override global ones.
 *
 * Custom modes (Roo's custom agents) live as a YAML list under the
 * `customModes` key of settings/custom_modes.yaml next to mcp_settings.json
 * (project scope: a .roomodes file at the workspace root, YAML with a JSON
 * fallback); each mode has a slug, display name, roleDefinition, and
 * optional description/whenToUse/customInstructions plus a tool `groups`
 * list. Project modes take precedence over global modes by slug.
 */
const CANDIDATE_RELS = [
  ".config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json",
  "Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json",
  "AppData/Roaming/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json",
];
const RULES_REL = ".roo/rules";
const SKILLS_REL = ".roo/skills";
const COMMANDS_DIR_REL = ".roo/commands";

export const ROO_COMMANDS_WARNING =
  "commands: frontmatter fields (description/argument-hint/mode) are client-specific and copied as-is; review after import";

const CLIENT_KEYS = ["alwaysAllow", "disabledTools", "timeout", "watchPaths"] as const;

const MODE_PORTABLE_FIELDS = ["slug", "description", "roleDefinition", "source"];
const MODE_DEFAULT_GROUPS = ["read", "edit", "browser", "command", "mcp"];

export const ROO_AGENTS_EXPORT_WARNING =
  "agents: converted from roo custom modes (slug + description + roleDefinition); roo-specific fields are dropped with per-field warnings";

export const ROO_AGENTS_IMPORT_WARNING =
  "agents: written as roo custom modes with full tool groups; review name/groups/customInstructions in the target mode after import";

function frontmatterLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

function parseFrontmatterDescription(line: string): string | undefined {
  const m = /^description:\s*(.+)$/.exec(line);
  if (!m?.[1]) return undefined;
  let value = m[1].trim();
  if (value.startsWith('"')) {
    try {
      value = JSON.parse(value) as string;
    } catch {
      value = value.replace(/^"|"$/g, "");
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }
  return value;
}

/** Convert one roo custom mode entry into a portable markdown agent. */
export function rooModeToAgent(mode: unknown, warnings: string[]): AgentDef | undefined {
  if (!isRecord(mode)) {
    warnings.push("agents: custom mode entry is not an object; not migrated");
    return undefined;
  }
  const slug = typeof mode.slug === "string" ? mode.slug : undefined;
  if (!slug) {
    warnings.push("agents: custom mode entry has no slug; not migrated");
    return undefined;
  }
  const roleDefinition = typeof mode.roleDefinition === "string" ? mode.roleDefinition : undefined;
  const description = typeof mode.description === "string" ? mode.description : undefined;
  if (roleDefinition === undefined && description === undefined) {
    warnings.push(`agents:${slug}: mode has neither roleDefinition nor description; not migrated`);
    return undefined;
  }
  for (const key of Object.keys(mode)) {
    if (key === "name") {
      if (mode.name !== slug) {
        warnings.push(
          `agents:${slug}: roo display name (${String(mode.name)}) has no portable equivalent; the slug is used`,
        );
      }
      continue;
    }
    if (!MODE_PORTABLE_FIELDS.includes(key)) {
      warnings.push(`agents:${slug}: roo mode field "${key}" has no portable equivalent; dropped`);
    }
  }
  let body = roleDefinition ?? "";
  if (body && !body.endsWith("\n")) body += "\n";
  const content =
    description !== undefined
      ? `---\n${frontmatterLine("description", description)}\n---\n${body}`
      : body;
  return { name: slug, content };
}

/** Read all custom modes from a custom_modes.yaml / .roomodes file. */
export async function readRooModes(file: string, warnings: string[]): Promise<AgentDef[]> {
  const raw = await readText(file);
  if (raw === undefined) return [];
  let data: unknown;
  try {
    data = parseYaml(raw) as unknown;
  } catch {
    if (file.endsWith(".roomodes")) {
      try {
        data = JSON.parse(raw);
      } catch {
        warnings.push(`agents:${path.basename(file)}: invalid YAML/JSON; not migrated`);
        return [];
      }
    } else {
      warnings.push(`agents:${path.basename(file)}: invalid YAML; not migrated`);
      return [];
    }
  }
  if (!isRecord(data) || !Array.isArray(data.customModes)) return [];
  const agents: AgentDef[] = [];
  for (const mode of data.customModes) {
    const agent = rooModeToAgent(mode, warnings);
    if (agent) agents.push(agent);
  }
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/** Convert a portable markdown agent into a roo custom mode entry. */
export function agentToRooMode(a: AgentDef, warnings: string[]): Record<string, unknown> {
  let slug = a.name;
  if (slug.includes("/")) {
    slug = slug.replace(/\//g, "-");
    warnings.push(`agents:${a.name}: roo mode slugs cannot be nested; imported as ${slug}`);
  }
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    const sanitized = slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
    warnings.push(
      `agents:${a.name}: roo mode slugs allow only letters, numbers, and dashes; imported as ${sanitized}`,
    );
    slug = sanitized;
  }
  let description: string | undefined;
  let roleDefinition = a.content;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(a.content);
  if (m) {
    const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
    const parsed = lines.map((l) => parseFrontmatterDescription(l));
    if (parsed.every((p) => p !== undefined)) {
      description = parsed.find((p) => p !== undefined);
      roleDefinition = a.content.slice(m[0].length);
    } else {
      warnings.push(
        `agents:${a.name}: frontmatter has fields beyond description, which roo custom modes cannot express; kept verbatim inside roleDefinition`,
      );
    }
  }
  const mode: Record<string, unknown> = { slug, name: slug };
  if (description !== undefined) mode.description = description;
  mode.roleDefinition = roleDefinition || description || "";
  mode.groups = [...MODE_DEFAULT_GROUPS];
  return mode;
}

/** Plan a custom modes file write, merging imported modes over existing ones by slug. */
export function planRooModes(
  agents: AgentDef[],
  existing: unknown,
  rel: string,
  warnings: string[],
): FilePlan {
  const existingModes =
    isRecord(existing) && Array.isArray(existing.customModes) ? existing.customModes : [];
  const bySlug = new Map<string, unknown>();
  const unkeyed: unknown[] = [];
  for (const mode of existingModes) {
    if (isRecord(mode) && typeof mode.slug === "string") bySlug.set(mode.slug, mode);
    else unkeyed.push(mode);
  }
  for (const a of agents) {
    const mode = agentToRooMode(a, warnings);
    const slug = mode.slug as string;
    if (bySlug.has(slug)) {
      warnings.push(`agents:${slug}: overwrote existing roo custom mode with the same slug`);
    }
    bySlug.set(slug, mode);
  }
  const config: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};
  config.customModes = [...unkeyed, ...bySlug.values()];
  return { path: rel, content: stringifyYaml(config, { lineWidth: 0 }) };
}

function platformDefaultRel(): string {
  if (process.platform === "darwin") return CANDIDATE_RELS[1]!;
  if (process.platform === "win32") return CANDIDATE_RELS[2]!;
  return CANDIDATE_RELS[0]!;
}

async function findConfigRel(home: string): Promise<string | undefined> {
  for (const rel of CANDIDATE_RELS) {
    if (await exists(path.join(home, rel))) return rel;
  }
  return undefined;
}

function modesRelFor(configRel: string): string {
  return configRel.replace(/mcp_settings\.json$/, "custom_modes.yaml");
}

async function findModesRel(home: string): Promise<string | undefined> {
  for (const rel of CANDIDATE_RELS) {
    const modesRel = modesRelFor(rel);
    if (await exists(path.join(home, modesRel))) return modesRel;
  }
  return undefined;
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseRooServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, rawEntry] of Object.entries(serversObj)) {
    let entry = rawEntry;
    if (isRecord(entry) && entry.type === "streamable-http") {
      entry = { ...entry, type: "http" };
    }
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(rawEntry)) {
      if (rawEntry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (rawEntry[key] !== undefined) {
          warnings.push(`mcp:${name}: roo ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderRooServers(bundle: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, s.transport !== "stdio");
    if (entry.type === "http") entry.type = "streamable-http"; // Roo's spelling; bare url errors
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

export async function readRulesDir(
  root: string,
  warnings: string[],
  scope: string,
): Promise<string | undefined> {
  if (!(await isDir(root))) return undefined;
  const parts: string[] = [];
  for (const f of (await listDir(root)).sort()) {
    if (!f.endsWith(".md")) continue;
    const content = await readText(path.join(root, f));
    if (content?.trim()) parts.push(`<!-- rule: ${f} -->\n${content.trim()}`);
  }
  if (parts.length > 1) {
    warnings.push(`instructions: roo ${scope} rules files merged into one document`);
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const roo: ClientAdapter = {
  id: "roo",
  label: "Roo Code",
  defaultPath:
    "~/.roo (rules/ + skills/ + commands/) + VS Code globalStorage mcp_settings.json + custom_modes.yaml",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (await findConfigRel(home)) !== undefined || (await isDir(path.join(home, ".roo")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "roo";

    const rel = await findConfigRel(home);
    const config = rel ? await readJsonMap(path.join(home, rel)) : {};
    bundle.config.raw = config;
    bundle.mcpServers = parseRooServers(config, warnings);
    bundle.instructions = await readRulesDir(path.join(home, RULES_REL), warnings, "global");
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readAgentsDir(path.join(home, COMMANDS_DIR_REL), ".md");
    const modesRel = await findModesRel(home);
    if (modesRel) {
      bundle.agents = await readRooModes(path.join(home, modesRel), warnings);
      if (bundle.agents.length) warnings.push(ROO_AGENTS_EXPORT_WARNING);
    }
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const rel = (await findConfigRel(home)) ?? platformDefaultRel();
    const config = await readJsonMap(path.join(home, rel));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderRooServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: roo has no persona file; appended to ~/.roo/rules/agentmove.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({
        path: `${RULES_REL}/agentmove.md`,
        content: appendSections(bundle.instructions, sections),
      });
    }
    if (bundle.memory.length) {
      warnings.push("memory: roo has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, COMMANDS_DIR_REL, "roo", warnings));
      warnings.push(ROO_COMMANDS_WARNING);
    }
    if (bundle.agents.length) {
      const modesRel = (await findModesRel(home)) ?? modesRelFor(rel);
      const raw = await readText(path.join(home, modesRel));
      let existingModes: unknown;
      if (raw !== undefined) {
        try {
          existingModes = parseYaml(raw) as unknown;
        } catch {
          warnings.push(
            "agents: existing custom_modes.yaml is invalid YAML; existing modes were not preserved",
          );
        }
      }
      files.push(planRooModes(bundle.agents, existingModes, modesRel, warnings));
      warnings.push(ROO_AGENTS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};
