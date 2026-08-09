import path from "node:path";
import JSON5 from "json5";
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
  Skill,
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDir,
  readAgentsDirRecursive,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * OpenCode. MCP servers live under the `mcp` key of
 * ~/.config/opencode/opencode.json (opencode.jsonc also accepted): local
 * servers use `type: "local"` with `command` as an argv array plus
 * `environment`, remote servers use `type: "remote"` + `url`; both take an
 * `enabled` boolean. Instructions are ~/.config/opencode/AGENTS.md and
 * skills are native SKILL.md directories: opencode scans its config dirs
 * (~/.config/opencode/ plus a ~/.opencode/ fallback) under both skills/ and
 * the singular skill/, and also loads the generic shared root
 * ~/.agents/skills/ (project: .opencode/{skills,skill}/ + .agents/skills/).
 * Duplicate names keep the first copy in our root order below with a warning
 * (opencode itself keys skills by frontmatter name and its duplicate pick is
 * load-order dependent); imports write only ~/.config/opencode/skills/. The
 * Claude-compatible root ~/.claude/skills/ that opencode also scans belongs
 * to the claude adapters and is not read here.
 * Custom agents/subagents and custom commands are markdown files discovered
 * recursively in every config dir under both plural and singular directories
 * ({agent,agents}/ and {command,commands}/; nested paths become part of the
 * name, e.g. `team/review`). opencode merges config dirs in order and the
 * last dir wins per name, so the ~/.opencode fallback overrides
 * ~/.config/opencode; within one dir we deterministically prefer the plural
 * directory. Duplicate names emit a shadow warning. Imports write only the
 * native plural roots (~/.config/opencode/agents/ and commands/).
 * Primary modes are top-level markdown files in {mode,modes}/ of the same
 * config dirs (flat scan, no nesting); opencode merges them into the agent
 * map after the agent dirs, so a mode beats a same-name agent within one
 * config dir and runs with `mode: "primary"`. They are exported into the
 * agents layer byte-faithfully with a per-entry warning; imports still write
 * only agents/ and never synthesize mode files.
 */
const CONFIG_DIR_REL = ".config/opencode";
const CONFIG_REL = ".config/opencode/opencode.json";
const CONFIG_JSONC_REL = ".config/opencode/opencode.jsonc";
const AGENTS_REL = ".config/opencode/AGENTS.md";
const SKILLS_REL = ".config/opencode/skills";
const SKILLS_ROOTS = [
  ".config/opencode/skills",
  ".config/opencode/skill",
  ".opencode/skills",
  ".opencode/skill",
  ".agents/skills",
];
const AGENTS_DIR_REL = ".config/opencode/agents";

/** One opencode agent/command discovery root. */
export interface OpencodeEntryRoot {
  rel: string;
  /** Flat `*.md` scan (opencode's mode dirs load no nested files). */
  flat?: boolean;
  /** Entries are primary modes: opencode loads them with `mode: "primary"`. */
  primaryMode?: boolean;
}

export const OPENCODE_MODE_ROOTS = (dir: string): OpencodeEntryRoot[] => [
  { rel: `${dir}/modes`, flat: true, primaryMode: true },
  { rel: `${dir}/mode`, flat: true, primaryMode: true },
];

const AGENT_ROOTS: (string | OpencodeEntryRoot)[] = [
  ...OPENCODE_MODE_ROOTS(".opencode"),
  ".opencode/agents",
  ".opencode/agent",
  ...OPENCODE_MODE_ROOTS(".config/opencode"),
  ".config/opencode/agents",
  ".config/opencode/agent",
];
const COMMANDS_DIR_REL = ".config/opencode/commands";
const COMMAND_ROOTS: (string | OpencodeEntryRoot)[] = [
  ".opencode/commands",
  ".opencode/command",
  ".config/opencode/commands",
  ".config/opencode/command",
];

async function readConfig(
  home: string,
  warnings: string[],
): Promise<{ config: Record<string, unknown>; rel: string }> {
  for (const rel of [CONFIG_REL, CONFIG_JSONC_REL]) {
    const file = path.join(home, rel);
    const raw = await readText(file);
    if (raw === undefined) continue;
    const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
    if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
      warnings.push(`opencode ${path.basename(rel)}: existing comments are not preserved on rewrite`);
    }
    return { config: isRecord(data) ? data : {}, rel };
  }
  return { config: {}, rel: CONFIG_REL };
}

/** Merge opencode's skill roots in priority order; the first copy of a name wins. */
export async function readOpencodeSkills(
  base: string,
  roots: string[],
  warnings: string[],
): Promise<Skill[]> {
  const skills: Skill[] = [];
  const winner = new Map<string, string>();
  for (const rootRel of roots) {
    for (const skill of await readSkillsDir(path.join(base, rootRel), warnings)) {
      const winnerRoot = winner.get(skill.name);
      if (winnerRoot !== undefined) {
        warnings.push(
          `skills:${skill.name}: ${rootRel} copy shadowed by the ${winnerRoot} version (opencode keeps one skill per name); the ${winnerRoot} version is exported`,
        );
        continue;
      }
      winner.set(skill.name, rootRel);
      skills.push(skill);
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

/** Normalize an OpenCode entry into the common shape parseCommonMcpEntry understands. */
export function fromOpencodeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out: Record<string, unknown> = { ...entry };
  if (out.type === "local") out.type = "stdio";
  if (out.type === "remote") out.type = "http";
  if (Array.isArray(out.command) && out.command.every((c) => typeof c === "string")) {
    const [cmd, ...args] = out.command as string[];
    out.command = cmd;
    if (args.length && out.args === undefined) out.args = args;
  }
  if (isRecord(out.environment) && out.env === undefined) {
    out.env = out.environment;
    delete out.environment;
  }
  return out;
}

/** Render a portable server into OpenCode's spelling. */
export function toOpencodeEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  const common = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
  const out: Record<string, unknown> = {};
  if (s.transport === "stdio") {
    out.type = "local";
    out.command = [s.command ?? "", ...(s.args ?? [])].filter((c) => c !== "");
    if (isRecord(common.env)) out.environment = common.env;
  } else {
    if (s.transport === "sse") {
      warnings.push(`mcp:${s.name}: opencode has no sse type; emitted as remote`);
    }
    out.type = "remote";
    if (s.url) out.url = s.url;
    if (isRecord(common.headers)) out.headers = common.headers;
  }
  if (s.cwd) warnings.push(`mcp:${s.name}: opencode does not support cwd; dropped`);
  if (s.enabled === false) out.enabled = false;
  return out;
}

/** Merge opencode's agent/command roots in priority order; the first copy of a name wins. */
export async function readOpencodeEntries(
  base: string,
  roots: (string | OpencodeEntryRoot)[],
  layer: "agents" | "commands",
  warnings: string[],
): Promise<AgentDef[]> {
  const singular = layer === "agents" ? "agent" : "command";
  const entries: AgentDef[] = [];
  const winner = new Map<string, string>();
  for (const root of roots) {
    const spec = typeof root === "string" ? { rel: root } : root;
    const dir = path.join(base, spec.rel);
    const found = spec.flat
      ? await readAgentsDir(dir, ".md")
      : await readAgentsDirRecursive(dir, ".md");
    for (const entry of found) {
      const winnerRoot = winner.get(entry.name);
      if (winnerRoot !== undefined) {
        warnings.push(
          `${layer}:${entry.name}: ${spec.rel} copy shadowed by the ${winnerRoot} version (opencode keeps one ${singular} per name); the ${winnerRoot} version is exported`,
        );
        continue;
      }
      winner.set(entry.name, spec.rel);
      entries.push(entry);
      if (spec.primaryMode) {
        warnings.push(
          `${layer}:${entry.name}: ${spec.rel} entry is an opencode primary mode (loaded with mode: "primary"); exported as a regular agent`,
        );
      }
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export const opencode: ClientAdapter = {
  id: "opencode",
  label: "OpenCode",
  defaultPath: "~/.config/opencode (opencode.json + AGENTS.md + skills/ + agents/ + commands/)",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (
      (await exists(path.join(home, CONFIG_REL))) ||
      (await exists(path.join(home, CONFIG_JSONC_REL))) ||
      (await isDir(path.join(home, CONFIG_DIR_REL)))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "opencode";

    const { config } = await readConfig(home, []);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcp) ? config.mcp : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, fromOpencodeEntry(entry), warnings);
      if (s) {
        if (isRecord(entry) && entry.enabled === false) s.enabled = false;
        servers.push(s);
      }
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readOpencodeSkills(home, SKILLS_ROOTS, warnings);
    bundle.agents = await readOpencodeEntries(home, AGENT_ROOTS, "agents", warnings);
    bundle.commands = await readOpencodeEntries(home, COMMAND_ROOTS, "commands", warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const { config, rel } = await readConfig(home, warnings);
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      rendered[s.name] = toOpencodeEntry(s, warnings);
    }
    const existing = isRecord(config.mcp) ? config.mcp : {};
    config.mcp = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: opencode has no persona file; appended to ~/.config/opencode/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    files.push(...planSkills(bundle.skills, SKILLS_REL));

    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(
        "agents: frontmatter fields (mode/model/permission) are client-specific and copied as-is; review after import",
      );
    }

    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_DIR_REL, ".md"));
      warnings.push(
        "commands: frontmatter fields (agent/model) and argument placeholders are client-specific and copied as-is; review after import",
      );
    }

    if (bundle.memory.length) {
      warnings.push("memory: opencode has no durable memory store; skipped (consider --mif)");
    }
    return { files, warnings };
  },
};
