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
  defaultPath: "~/.roo (rules/ + skills/ + commands/) + VS Code globalStorage mcp_settings.json",
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
    return { files, warnings };
  },
};
