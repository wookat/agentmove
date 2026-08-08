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
  mergeAgentLists,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDirRecursive,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Trae (ByteDance, VS Code-based AI IDE). User-scoped MCP servers, rules,
 * and memories are app-managed through Settings and have no documented
 * config file; the documented user-level files are global skills under
 * ~/.trae/skills/ (Agent Skills standard) and global commands under
 * ~/.trae/commands/ (~/.trae-cn/commands/ in the CN edition). Project scope
 * is where the rest of Trae's files live: .trae/mcp.json (`mcpServers`,
 * standard notation — stdio uses command/args/env, remote uses url/headers,
 * no `type` or `disabled` field; needs the "Enable Project MCP" toggle),
 * .trae/rules/*.md project rules, .trae/skills/ project skills, and
 * .trae/commands/ project commands (nested up to 3 directory levels).
 */
const SKILLS_REL = ".trae/skills";
const COMMANDS_REL = ".trae/commands";
const CN_COMMANDS_REL = ".trae-cn/commands";

export const TRAE_COMMANDS_WARNING =
  "commands: trae command frontmatter (name/description) and argument conventions from other clients are client-specific and copied as-is; review after import";

export function warnTraeCommandDepth(
  commands: { name: string }[],
  warnings: string[],
  rel: string,
): void {
  for (const c of commands) {
    if (c.name.split("/").length > 4) {
      warnings.push(
        `commands:${c.name}: trae reads at most 3 nested directory levels under ${rel}; written but not recognized by trae`,
      );
    }
  }
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseTraeServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (s) servers.push(s);
  }
  return servers;
}

export function renderTraeServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(
        `mcp:${s.name}: trae has no disabled flag in mcp.json (toggled via the MCP settings UI); server emitted as enabled`,
      );
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: trae remote servers are plain url entries; sse written without a transport type`,
      );
    }
    if (s.cwd) warnings.push(`mcp:${s.name}: trae does not support cwd; dropped`);
    out[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, false);
  }
  return out;
}

export async function planTraeMcp(
  bundle: Bundle,
  mcpFile: string,
  mcpRel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readJsonMap(mcpFile);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(
    existing,
    renderTraeServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: mcpRel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const trae: ClientAdapter = {
  id: "trae",
  label: "Trae",
  defaultPath: "~/.trae (skills/ + commands/; MCP/rules are project-scoped)",
  supportsCommands: true,

  async detect(home) {
    return isDir(path.join(home, ".trae"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "trae";

    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    const cnRoot = await readAgentsDirRecursive(path.join(home, CN_COMMANDS_REL), ".md");
    bundle.commands = mergeAgentLists(
      cnRoot,
      await readAgentsDirRecursive(path.join(home, COMMANDS_REL), ".md"),
    );
    if (cnRoot.length) {
      warnings.push(
        "commands: ~/.trae-cn/commands/ (CN edition) files exported; ~/.trae/commands/ wins on name conflicts",
      );
    }
    warnings.push(
      "mcp: trae user-level MCP servers are app-managed (Settings > MCP) with no documented config file; use --project for .trae/mcp.json",
    );
    warnings.push("instructions: trae global rules are app-managed; use --project for .trae/rules");
    return { bundle, warnings };
  },

  async planImport(bundle, home, _opts): Promise<ImportResult> {
    void home;
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: trae user-level MCP servers are app-managed (Settings > MCP); import with --project to write .trae/mcp.json",
      );
    }
    if (bundle.instructions) {
      warnings.push(
        "instructions: trae global rules are app-managed; import with --project to write .trae/rules",
      );
    }
    if (bundle.persona) warnings.push("persona: trae has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: trae memories are app-managed; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_REL, ".md"));
      warnings.push(TRAE_COMMANDS_WARNING);
      warnTraeCommandDepth(bundle.commands, warnings, COMMANDS_REL);
    }
    return { files, warnings };
  },
};
