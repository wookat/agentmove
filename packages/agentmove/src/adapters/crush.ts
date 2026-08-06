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
 * Crush (Charm). MCP servers live under the `mcp` key of
 * ~/.config/crush/crush.json (`type` is required: stdio/http/sse; stdio uses
 * command/args/env, remote uses url/headers; native `disabled` flag). Skills
 * follow the open Agent Skills standard under ~/.config/crush/skills/.
 * Instructions/context files (CRUSH.md, AGENTS.md, ...) are project-scoped
 * only; Crush has no global instructions file or durable memory store.
 */
const CONFIG_REL = ".config/crush/crush.json";
const SKILLS_REL = ".config/crush/skills";

const CLIENT_KEYS = ["disabled_tools", "timeout"] as const;

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseCrushServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcp) ? config.mcp : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (entry[key] !== undefined) {
          warnings.push(`mcp:${name}: crush ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderCrushServers(bundle: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, true);
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

export const crush: ClientAdapter = {
  id: "crush",
  label: "Crush",
  defaultPath: "~/.config/crush (crush.json + skills/)",

  async detect(home) {
    return await isDir(path.join(home, ".config/crush"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "crush";

    const config = await readJsonMap(path.join(home, CONFIG_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseCrushServers(config, warnings);
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    warnings.push(
      "instructions: crush context files (CRUSH.md/AGENTS.md) are project-scoped; nothing exported at user scope",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    void home;
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, CONFIG_REL));
    const existing = isRecord(config.mcp) ? config.mcp : {};
    config.mcp = mergeMcpRecords(
      existing,
      renderCrushServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: CONFIG_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: crush reads context files per project; import with --project to write CRUSH.md",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: crush has no persona file; skipped (use --project for CRUSH.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: crush has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
