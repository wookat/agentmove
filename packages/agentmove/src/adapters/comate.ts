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
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Baidu Comate (文心快码) — the Zulu agent in the Comate IDE plugins and
 * Comate AI IDE. MCP servers are project-scoped only (.comate/mcp.json,
 * `mcpServers`, standard notation: stdio uses command/args/env, remote uses
 * url/headers, no `type` field; per-server enable/disable is toggled in the
 * UI, not stored in mcp.json). Project rules are .comate/rules/*.mdr
 * (markdown with a Cursor-style description/globs/alwaysApply frontmatter),
 * and skills follow the Agent Skills standard under .comate/skills/
 * (project) and ~/.comate/skills/ (user/global). Chat memory is app-managed
 * under .comate.
 */
const SKILLS_REL = ".comate/skills";

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseComateServers(
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

export function renderComateServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(
        `mcp:${s.name}: comate has no disabled flag in mcp.json (toggled in the installed-servers UI); server emitted as enabled`,
      );
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: comate remote servers are plain url entries; sse written without a transport type`,
      );
    }
    if (s.cwd) warnings.push(`mcp:${s.name}: comate does not support cwd; dropped`);
    out[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, false);
  }
  return out;
}

export async function planComateMcp(
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
    renderComateServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: mcpRel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const comate: ClientAdapter = {
  id: "comate",
  label: "Baidu Comate",
  defaultPath: "~/.comate/skills (MCP/rules are project-scoped: .comate/mcp.json + .comate/rules)",

  async detect(home) {
    return isDir(path.join(home, ".comate"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "comate";

    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    warnings.push(
      "mcp: comate MCP servers are project-scoped (.comate/mcp.json) with no user-level config file; use --project",
    );
    warnings.push("instructions: comate rules are project-scoped (.comate/rules/*.mdr); use --project");
    return { bundle, warnings };
  },

  async planImport(bundle, home, _opts): Promise<ImportResult> {
    void home;
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: comate MCP servers are project-scoped only; import with --project to write .comate/mcp.json",
      );
    }
    if (bundle.instructions) {
      warnings.push(
        "instructions: comate rules are project-scoped (.comate/rules/*.mdr); import with --project",
      );
    }
    if (bundle.persona) warnings.push("persona: comate has no user-scoped persona file; skipped (use --project)");
    if (bundle.memory.length) {
      warnings.push("memory: comate chat memory is app-managed; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
