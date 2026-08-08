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
 * Qwen Code (a Gemini CLI fork). MCP servers live under the `mcpServers` key
 * of ~/.qwen/settings.json; context/instructions are ~/.qwen/QWEN.md with
 * saved memories under a "## Qwen Added Memories" section; skills are native
 * SKILL.md directories under ~/.qwen/skills/ and custom agents/subagents are
 * markdown files under ~/.qwen/agents/. Custom commands are markdown files
 * under ~/.qwen/commands/ (subdirectories become `/git:commit`-style names;
 * the legacy TOML format is deprecated and not migrated).
 */
const SETTINGS_REL = ".qwen/settings.json";
const CONTEXT_REL = ".qwen/QWEN.md";
const SKILLS_REL = ".qwen/skills";
const AGENTS_DIR_REL = ".qwen/agents";
const COMMANDS_DIR_REL = ".qwen/commands";
const MEMORY_HEADING = "## Qwen Added Memories";

function splitContext(content: string): { instructions?: string; memories: string[] } {
  const idx = content.indexOf(MEMORY_HEADING);
  if (idx === -1) return { instructions: content, memories: [] };
  const before = content.slice(0, idx).trimEnd();
  const after = content.slice(idx + MEMORY_HEADING.length);
  const end = after.indexOf("\n## ");
  const section = end === -1 ? after : after.slice(0, end);
  const rest = end === -1 ? "" : after.slice(end);
  const memories = section
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  const instructions = (before + rest).trim();
  return { instructions: instructions || undefined, memories };
}

async function readSettings(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, SETTINGS_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export const qwen: ClientAdapter = {
  id: "qwen",
  label: "Qwen Code",
  defaultPath: "~/.qwen (settings.json + QWEN.md + skills/ + agents/ + commands/)",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (await exists(path.join(home, SETTINGS_REL))) || (await isDir(path.join(home, ".qwen")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "qwen";

    const settings = await readSettings(home);
    bundle.config.raw = settings;
    const serversObj = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    const context = await readText(path.join(home, CONTEXT_REL));
    if (context) {
      const { instructions, memories } = splitContext(context);
      bundle.instructions = instructions;
      bundle.memory = memories.map((content) => ({
        content,
        source: "QWEN.md#qwen-added-memories",
        kind: "long-term" as const,
      }));
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.agents = await readAgentsDir(path.join(home, AGENTS_DIR_REL), ".md");
    const commandsRoot = path.join(home, COMMANDS_DIR_REL);
    bundle.commands = await readAgentsDirRecursive(commandsRoot, ".md");
    for (const t of await readAgentsDirRecursive(commandsRoot, ".toml")) {
      warnings.push(
        `commands:${t.name}: qwen TOML commands are deprecated and not migrated; convert to markdown first`,
      );
    }
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const settings = await readSettings(home);
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: qwen has no disabled flag; server emitted as enabled`);
      }
      mcpServers[s.name] = renderCommonMcpEntry(s, false);
    }
    const existing = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    settings.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: SETTINGS_REL, content: JSON.stringify(settings, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: qwen has no persona file; appended to ~/.qwen/QWEN.md (approximated)");
    }
    if (bundle.memory.length) {
      parts.push(
        `${MEMORY_HEADING}\n` +
          bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, " ")}`).join("\n"),
      );
    }
    if (parts.length) files.push({ path: CONTEXT_REL, content: parts.join("\n\n") + "\n" });

    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_DIR_REL, ".md"));
      warnings.push(
        "commands: argument placeholders ({{args}}/!{...}/@{...}) and frontmatter are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/approvalMode) are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};
