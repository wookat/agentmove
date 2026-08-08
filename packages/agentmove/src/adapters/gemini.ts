import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  Bundle,
  ClientAdapter,
  ClientId,
  CommandDef,
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
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDir,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

const MEMORY_HEADING = "## Gemini Added Memories";

export const GEMINI_COMMANDS_EXPORT_WARNING =
  "commands: converted from gemini TOML (prompt/description); {{args}}, !{...}, and @{...} placeholders are gemini-specific and copied as-is";

export const GEMINI_COMMANDS_IMPORT_WARNING =
  "commands: gemini custom commands are TOML files; markdown bodies were converted to the prompt field ({{args}}, !{...}, and @{...} placeholders copied as-is; review after import)";

/** Convert one gemini `*.toml` command file into a portable markdown command. */
export function geminiCommandFromToml(
  name: string,
  raw: string,
  warnings: string[],
): CommandDef | undefined {
  let data: unknown;
  try {
    data = parseToml(raw);
  } catch {
    warnings.push(`commands:${name}.toml: invalid TOML; not migrated`);
    return undefined;
  }
  if (!isRecord(data)) {
    warnings.push(`commands:${name}.toml: not a TOML table; not migrated`);
    return undefined;
  }
  for (const key of Object.keys(data)) {
    if (key !== "prompt" && key !== "description") {
      warnings.push(`commands:${name}: TOML field "${key}" is not a documented gemini command field; dropped`);
    }
  }
  if (typeof data.prompt !== "string") {
    warnings.push(`commands:${name}.toml: no prompt string field; not migrated`);
    return undefined;
  }
  const description = typeof data.description === "string" ? data.description : undefined;
  const body = data.prompt.endsWith("\n") ? data.prompt : data.prompt + "\n";
  const content =
    description !== undefined
      ? `---\ndescription: ${JSON.stringify(description)}\n---\n${body}`
      : body;
  return { name, content };
}

/** Convert a portable markdown command into gemini TOML file content. */
export function geminiCommandToToml(c: CommandDef, warnings: string[]): string {
  let description: string | undefined;
  let prompt = c.content;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(c.content);
  if (m) {
    const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
    const descMatch = lines.length === 1 ? /^description:\s*(.+)$/.exec(lines[0] ?? "") : null;
    if (descMatch?.[1]) {
      let value = descMatch[1].trim();
      if (value.startsWith('"')) {
        try {
          value = JSON.parse(value) as string;
        } catch {
          value = value.replace(/^"|"$/g, "");
        }
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      description = value;
      prompt = c.content.slice(m[0].length);
    } else {
      warnings.push(
        `commands:${c.name}: frontmatter has fields beyond description, which gemini TOML cannot express; kept verbatim inside prompt`,
      );
    }
  }
  const record: Record<string, string> = {};
  if (description !== undefined) record.description = description;
  record.prompt = prompt;
  return stringifyToml(record) + "\n";
}

/** Read every `*.toml` command under a gemini commands root (recursive). */
export async function readGeminiCommands(root: string, warnings: string[]): Promise<CommandDef[]> {
  const commands: CommandDef[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const name of (await listDir(dir)).sort()) {
      const full = path.join(dir, name);
      if (await isDir(full)) {
        if (!name.startsWith(".")) await walk(full, `${prefix}${name}/`);
        continue;
      }
      if (!name.endsWith(".toml")) continue;
      const raw = await readText(full);
      if (raw === undefined) continue;
      const cmd = geminiCommandFromToml(`${prefix}${name.slice(0, -".toml".length)}`, raw, warnings);
      if (cmd) commands.push(cmd);
    }
  };
  if (await isDir(root)) await walk(root, "");
  return commands;
}

/** Plan gemini TOML command writes into a commands root (nested names preserved). */
export function planGeminiCommands(
  commands: CommandDef[],
  rootRel: string,
  warnings: string[],
): FilePlan[] {
  return commands.map((c) => ({
    path: `${rootRel}/${c.name}.toml`,
    content: geminiCommandToToml(c, warnings),
  }));
}

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

export interface GeminiStyleLayout {
  id: ClientId;
  label: string;
  defaultPath: string;
  /** Directory holding settings.json/GEMINI.md, relative to home. */
  configDir: string;
  /** Agent Skills directory relative to home; omitted when the client has none. */
  skillsDir?: string;
  /** Custom subagents directory relative to home; omitted when the client has none. */
  agentsDir?: string;
  /** TOML custom commands directory relative to home; omitted when unverified. */
  commandsDir?: string;
}

/**
 * Gemini CLI stores settings.json + GEMINI.md in a config directory
 * (~/.gemini for the standalone CLI, its own root under ~/Library for
 * Xcode's bundled Gemini agent). The standalone CLI also discovers Agent
 * Skills under ~/.gemini/skills/ (with ~/.agents/skills/ as an alias).
 */
export function makeGeminiStyleAdapter(layout: GeminiStyleLayout): ClientAdapter {
  const { id, configDir, skillsDir, agentsDir, commandsDir } = layout;
  const SETTINGS_REL = `${configDir}/settings.json`;
  const CONTEXT_REL = `${configDir}/GEMINI.md`;

  return {
    id,
    label: layout.label,
    defaultPath: layout.defaultPath,
    supportsAgents: Boolean(agentsDir),
    supportsCommands: Boolean(commandsDir),

    async detect(home) {
      return (await exists(path.join(home, SETTINGS_REL))) || (await isDir(path.join(home, configDir)));
    },

    async exportBundle(home): Promise<ExportResult> {
      const warnings: string[] = [];
      const bundle: Bundle = emptyBundle();
      bundle.manifest.exportedFrom = id;

      const settingsFile = path.join(home, SETTINGS_REL);
      const raw = await readText(settingsFile);
      let settings: Record<string, unknown> = {};
      if (raw !== undefined) {
        const data = parseFile<unknown>(settingsFile, raw, JSON.parse);
        if (isRecord(data)) settings = data;
      }
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
          source: "GEMINI.md#gemini-added-memories",
          kind: "long-term" as const,
        }));
      }
      if (skillsDir) {
        bundle.skills = await readSkillsDir(path.join(home, skillsDir), warnings);
      }
      if (agentsDir) {
        bundle.agents = await readAgentsDir(path.join(home, agentsDir), ".md");
      }
      if (commandsDir) {
        bundle.commands = await readGeminiCommands(path.join(home, commandsDir), warnings);
        if (bundle.commands.length) warnings.push(GEMINI_COMMANDS_EXPORT_WARNING);
      }
      if (await isDir(path.join(home, `${configDir}/extensions`))) {
        warnings.push(`${id} extensions are not exported in v0 (install them on the target machine instead)`);
      }
      return { bundle, warnings };
    },

    async planImport(bundle, home, opts): Promise<ImportResult> {
      const warnings: string[] = [];
      const files: FilePlan[] = [];

      const settingsFile = path.join(home, SETTINGS_REL);
      const raw = await readText(settingsFile);
      let settings: Record<string, unknown> = {};
      if (raw !== undefined) {
        const data = parseFile<unknown>(settingsFile, raw, JSON.parse);
        if (isRecord(data)) settings = data;
      }
      const mcpServers: Record<string, unknown> = {};
      for (const s of bundle.mcpServers) {
        if (s.enabled === false) {
          warnings.push(`mcp:${s.name}: ${id} has no disabled flag; server emitted as enabled`);
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
        warnings.push(`persona: ${id} has no persona file; appended to ~/${CONTEXT_REL} (approximated)`);
      }
      if (bundle.memory.length) {
        parts.push(
          `${MEMORY_HEADING}\n` +
            bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, " ")}`).join("\n"),
        );
      }
      if (parts.length) files.push({ path: CONTEXT_REL, content: parts.join("\n\n") + "\n" });

      if (skillsDir) {
        files.push(...planSkills(bundle.skills, skillsDir));
      } else if (bundle.skills.length) {
        warnings.push(`skills: ${id} has no SKILL.md mechanism; skipped (consider a gemini extension)`);
      }
      if (agentsDir && bundle.agents.length) {
        files.push(...planAgents(bundle.agents, agentsDir, ".md"));
        warnings.push(
          `agents: ${id} subagents are experimental (enabled by default; "experimental": {"enableAgents": false} disables them); ` +
            "frontmatter fields are client-specific and copied as-is",
        );
      }
      if (commandsDir && bundle.commands.length) {
        files.push(...planGeminiCommands(bundle.commands, commandsDir, warnings));
        warnings.push(GEMINI_COMMANDS_IMPORT_WARNING);
      }
      return { files, warnings };
    },
  };
}

export const gemini: ClientAdapter = makeGeminiStyleAdapter({
  id: "gemini",
  label: "Gemini CLI",
  defaultPath: "~/.gemini",
  configDir: ".gemini",
  skillsDir: ".gemini/skills",
  agentsDir: ".gemini/agents",
  commandsDir: ".gemini/commands",
});
