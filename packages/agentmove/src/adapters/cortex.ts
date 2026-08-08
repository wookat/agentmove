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
 * Cortex Code — "CoCo" — (Snowflake). MCP servers live under the `mcpServers`
 * key of ~/.snowflake/cortex/mcp.json with an explicit `type` of
 * stdio/http/sse; stdio entries take command/args/env/cwd and remote entries
 * take url/headers, plus a client-specific per-server `timeout`. Global
 * instructions are ~/.snowflake/cortex/AGENTS.md and user skills follow the
 * Agent Skills standard under ~/.snowflake/cortex/skills/. Custom slash
 * commands are markdown files under ~/.snowflake/cortex/commands/ (part of
 * the documented install layout, managed via /commands); nested layouts are
 * preserved. No project-scoped commands directory is documented — project
 * commands ship only inside plugins — so project scope skips commands.
 */
const CONFIG_DIR_REL = ".snowflake/cortex";
const MCP_REL = ".snowflake/cortex/mcp.json";
const AGENTS_REL = ".snowflake/cortex/AGENTS.md";
const SKILLS_REL = ".snowflake/cortex/skills";
const COMMANDS_REL = ".snowflake/cortex/commands";

export const CORTEX_COMMANDS_WARNING =
  "commands: frontmatter and argument conventions from other clients are client-specific and copied as-is; review after import";

export async function readCortexMcp(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

export function parseCortexServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry) && entry.timeout !== undefined) {
      warnings.push(`mcp:${name}: cortex timeout is client-specific; not migrated`);
    }
    servers.push(s);
  }
  return servers;
}

export function toCortexEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  if (s.enabled === false) {
    warnings.push(`mcp:${s.name}: cortex has no disabled flag; server emitted as enabled`);
  }
  return renderCommonMcpEntry(s, true);
}

export async function planCortexMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readCortexMcp(file);
  const rendered: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    rendered[s.name] = toCortexEntry(s, warnings);
  }
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(existing, rendered, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const cortex: ClientAdapter = {
  id: "cortex",
  label: "Cortex Code",
  defaultPath: "~/.snowflake/cortex (mcp.json + AGENTS.md + skills/ + commands/)",
  supportsCommands: true,

  async detect(home) {
    return isDir(path.join(home, CONFIG_DIR_REL));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cortex";

    const config = await readCortexMcp(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseCortexServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(home, COMMANDS_REL), ".md");
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planCortexMcp(
        bundle,
        path.join(home, MCP_REL),
        MCP_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: cortex has no persona file; appended to ~/.snowflake/cortex/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      warnings.push(
        "memory: cortex memory (~/.snowflake/cortex/memory/) is agent-managed; skipped (consider --mif)",
      );
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_REL, ".md"));
      warnings.push(CORTEX_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};
