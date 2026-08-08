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
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import {
  mergeAgentLists,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planCommandsFlat,
  planSkills,
  readAgentsDir,
  readAgentsDirRecursive,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Kilo Code (Kilo CLI + VS Code/JetBrains extensions — all read the same
 * files). MCP servers live under the `mcp` key of ~/.config/kilo/kilo.json
 * (kilo.jsonc and config.json also accepted): local servers use
 * `type: "local"` with `command` as an argv array plus `environment`, remote
 * servers use `type: "remote"` + `url`/`headers`; both take an `enabled`
 * boolean and a client-specific `timeout`. Global instructions are
 * ~/.config/kilo/AGENTS.md and global skills follow the Agent Skills
 * standard under ~/.kilo/skills/.
 *
 * Custom slash commands (formerly "workflows") are top-level markdown files
 * under ~/.config/kilo/commands/; the legacy ~/.kilocode/workflows/ location
 * is still read (the extension auto-migrates it) with the new location
 * winning on name conflicts. Imports only write the new location.
 *
 * Custom agents (custom modes) are markdown files with YAML frontmatter
 * scanned recursively from the `agent/` and `agents/` subdirectories of
 * ~/.config/kilo/ plus the legacy ~/.kilocode/ and ~/.kilo/ home roots
 * (nested paths become namespaced names like `backend/sql`). Imports write
 * only ~/.config/kilo/agents/. Legacy custom_modes.yaml / .kilocodemodes
 * definitions are not migrated — Kilo itself auto-converts them to agent
 * markdown files on startup.
 */
const CONFIG_DIR_REL = ".config/kilo";
const CONFIG_RELS = [".config/kilo/kilo.json", ".config/kilo/kilo.jsonc", ".config/kilo/config.json"];
const AGENTS_REL = ".config/kilo/AGENTS.md";
const SKILLS_REL = ".kilo/skills";
const COMMANDS_DIR_REL = ".config/kilo/commands";
const LEGACY_WORKFLOWS_REL = ".kilocode/workflows";
const AGENT_ROOT_RELS = [".kilocode", ".kilo", ".config/kilo"];
const AGENTS_DIR_REL = ".config/kilo/agents";

export const KILO_AGENTS_WARNING =
  "agents: frontmatter fields (description/mode/model/permission/color/hidden) are client-specific and copied as-is; review after import";

export const KILO_COMMANDS_WARNING =
  "commands: frontmatter fields (description/agent/model/subtask) and argument placeholders are client-specific and copied as-is; review after import";

export async function readKiloConfig(
  candidates: string[],
  warnings: string[],
): Promise<{ config: Record<string, unknown>; rel: string }> {
  for (const rel of candidates) {
    const file = rel;
    const raw = await readText(file);
    if (raw === undefined) continue;
    const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
    if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
      warnings.push(`kilo ${path.basename(rel)}: existing comments are not preserved on rewrite`);
    }
    return { config: isRecord(data) ? data : {}, rel };
  }
  return { config: {}, rel: candidates[0]! };
}

/** Normalize a Kilo entry into the common shape parseCommonMcpEntry understands. */
export function fromKiloEntry(entry: unknown): unknown {
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

/** Render a portable server into Kilo's spelling. */
export function toKiloEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  const common = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
  const out: Record<string, unknown> = {};
  if (s.transport === "stdio") {
    out.type = "local";
    out.command = [s.command ?? "", ...(s.args ?? [])].filter((c) => c !== "");
    if (isRecord(common.env)) out.environment = common.env;
  } else {
    if (s.transport === "sse") {
      warnings.push(`mcp:${s.name}: kilo has no sse type; emitted as remote`);
    }
    out.type = "remote";
    if (s.url) out.url = s.url;
    if (isRecord(common.headers)) out.headers = common.headers;
  }
  if (s.cwd) warnings.push(`mcp:${s.name}: kilo does not support cwd; dropped`);
  if (s.enabled === false) out.enabled = false;
  return out;
}

export function parseKiloServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcp) ? config.mcp : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, fromKiloEntry(entry), warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.enabled === false) s.enabled = false;
      if (entry.timeout !== undefined) {
        warnings.push(`mcp:${name}: kilo timeout setting is client-specific; not migrated`);
      }
    }
    servers.push(s);
  }
  return servers;
}

export async function planKiloMcp(
  bundle: Bundle,
  candidates: string[],
  relOf: (abs: string) => string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const { config, rel } = await readKiloConfig(candidates, warnings);
  const rendered: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    rendered[s.name] = toKiloEntry(s, warnings);
  }
  const existing = isRecord(config.mcp) ? config.mcp : {};
  config.mcp = mergeMcpRecords(existing, rendered, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({
      path: relOf(rel).split(path.sep).join("/"),
      content: JSON.stringify(config, null, 2) + "\n",
    });
  }
  return files;
}

/**
 * Read Kilo custom agents from one config root: both the `agent/` and
 * `agents/` subdirectories are scanned recursively (matching Kilo's
 * `{agent,agents}/**\/*.md` glob), with `agents/` winning on name conflicts.
 */
export async function readKiloAgents(root: string): Promise<AgentDef[]> {
  return mergeAgentLists(
    await readAgentsDirRecursive(path.join(root, "agent"), ".md"),
    await readAgentsDirRecursive(path.join(root, "agents"), ".md"),
  );
}

export const kilo: ClientAdapter = {
  id: "kilo",
  label: "Kilo Code",
  defaultPath: "~/.config/kilo (kilo.json + AGENTS.md + agents/ + commands/) + ~/.kilo/skills",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    for (const rel of CONFIG_RELS) {
      if (await exists(path.join(home, rel))) return true;
    }
    return (await isDir(path.join(home, CONFIG_DIR_REL))) || (await isDir(path.join(home, ".kilo")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kilo";

    const { config } = await readKiloConfig(
      CONFIG_RELS.map((rel) => path.join(home, rel)),
      [],
    );
    bundle.config.raw = config;
    bundle.mcpServers = parseKiloServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    const legacy = await readAgentsDir(path.join(home, LEGACY_WORKFLOWS_REL), ".md");
    bundle.commands = mergeAgentLists(
      legacy,
      await readAgentsDir(path.join(home, COMMANDS_DIR_REL), ".md"),
    );
    if (legacy.length) {
      warnings.push(
        "commands: legacy ~/.kilocode/workflows/ files exported; kilo now uses ~/.config/kilo/commands/ (new location wins on name conflicts)",
      );
    }
    const agentLists: AgentDef[][] = [];
    for (const rel of AGENT_ROOT_RELS) {
      agentLists.push(await readKiloAgents(path.join(home, rel)));
    }
    bundle.agents = mergeAgentLists(...agentLists);
    if (agentLists.slice(0, 2).some((l) => l.length)) {
      warnings.push(
        "agents: legacy ~/.kilocode/ and ~/.kilo/ agent files exported; kilo's primary location is ~/.config/kilo/ (which wins on name conflicts)",
      );
    }
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planKiloMcp(
        bundle,
        CONFIG_RELS.map((rel) => path.join(home, rel)),
        (abs) => path.relative(home, abs),
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: kilo has no persona file; appended to ~/.config/kilo/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      warnings.push("memory: kilo has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, COMMANDS_DIR_REL, "kilo", warnings));
      warnings.push(KILO_COMMANDS_WARNING);
    }
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(KILO_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};
