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
  appendSections,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Junie (JetBrains). The IDE plugin and Junie CLI share the same files: MCP
 * servers live under the `mcpServers` key of ~/.junie/mcp/mcp.json (entries
 * have no `type` field — stdio uses command/args/env, remote uses
 * url/headers; servers are enabled by default and toggled via the /mcp UI,
 * not a JSON flag). Global guidelines live in ~/.junie/AGENTS.md and personal
 * skills follow the open Agent Skills standard under ~/.junie/skills/.
 */
const MCP_REL = ".junie/mcp/mcp.json";
const AGENTS_REL = ".junie/AGENTS.md";
const SKILLS_REL = ".junie/skills";

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseJunieServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    servers.push(s);
  }
  return servers;
}

export function renderJunieServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(
        `mcp:${s.name}: junie has no disabled flag in mcp.json (toggled via the /mcp UI); server emitted as enabled`,
      );
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: junie remote servers are plain url entries; sse written without a transport type`,
      );
    }
    out[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
  }
  return out;
}

export const junie: ClientAdapter = {
  id: "junie",
  label: "Junie",
  defaultPath: "~/.junie (mcp/mcp.json + AGENTS.md + skills/)",

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".junie")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "junie";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseJunieServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderJunieServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: junie has no persona file; appended to ~/.junie/AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: junie has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
