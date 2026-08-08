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
import { exists, isDir, listDir, readText } from "../fsutil.js";
import {
  appendSections,
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
 * Droid (Factory). MCP servers live under the `mcpServers` key of
 * ~/.factory/mcp.json (`type` stdio/http/sse, stdio may omit it; stdio uses
 * command/args/env, remote uses url/headers/oauth; native `disabled` flag;
 * ${NAME} references are expanded from the shell environment). Personal
 * instructions live in ~/.factory/AGENTS.md and personal skills follow the
 * open Agent Skills standard under ~/.factory/skills/. Custom droids
 * (subagents) are markdown files with YAML frontmatter under
 * ~/.factory/droids/ (personal) and .factory/droids/ (project).
 *
 * Custom slash commands are files under ~/.factory/commands/ (personal) and
 * .factory/commands/ (project), discovered recursively. Markdown files are
 * prompt commands; shebang script files are executable commands and are not
 * migrated (they are shell scripts, not portable prompts).
 */
const MCP_REL = ".factory/mcp.json";
const AGENTS_REL = ".factory/AGENTS.md";
const SKILLS_REL = ".factory/skills";
const DROIDS_REL = ".factory/droids";
const COMMANDS_DIR_REL = ".factory/commands";

const CLIENT_KEYS = ["disabledTools", "timeout", "connectTimeout", "oauth"] as const;

export const DROID_COMMANDS_WARNING =
  "commands: droid slugs command filenames (lowercased, spaces and non-URL characters become '-') and argument placeholders are client-specific; contents copied as-is, review after import";

/** Warn (per file) about droid shebang script commands, which are not migrated. */
export async function warnDroidScriptCommands(root: string, warnings: string[]): Promise<void> {
  if (!(await isDir(root))) return;
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const name of (await listDir(dir)).sort()) {
      if (name.startsWith(".")) continue;
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (await isDir(full)) {
        await walk(full, rel);
      } else if (!name.endsWith(".md")) {
        warnings.push(
          `commands:${rel}: droid executable script commands are not migrated; only markdown commands are`,
        );
      }
    }
  };
  await walk(root, "");
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseDroidServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (entry[key] !== undefined) {
          warnings.push(`mcp:${name}: droid ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderDroidServers(bundle: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, true);
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

export const droid: ClientAdapter = {
  id: "droid",
  label: "Droid",
  defaultPath: "~/.factory (mcp.json + AGENTS.md + skills/ + droids/ + commands/)",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".factory")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "droid";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseDroidServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.agents = await readAgentsDir(path.join(home, DROIDS_REL), ".md");
    bundle.commands = await readAgentsDirRecursive(path.join(home, COMMANDS_DIR_REL), ".md");
    await warnDroidScriptCommands(path.join(home, COMMANDS_DIR_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderDroidServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: droid has no persona file; appended to ~/.factory/AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: droid has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, DROIDS_REL, ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/reasoningEffort/mcpServers) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_DIR_REL, ".md"));
      warnings.push(DROID_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};
