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
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * LM Studio. The only migratable surface is ~/.lmstudio/mcp.json (same path
 * on macOS/Linux, %USERPROFILE%/.lmstudio on Windows), which follows Cursor's
 * mcp.json notation: an `mcpServers` map where stdio entries use
 * command/args/env and remote entries use url/headers. Everything else
 * (models, presets, chats) is app-managed.
 */
const MCP_REL = ".lmstudio/mcp.json";

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseLmstudioServers(
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

export function renderLmstudioServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(
        `mcp:${s.name}: lmstudio has no disabled flag in mcp.json; server emitted as enabled`,
      );
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: lmstudio remote servers are plain url entries; sse written without a transport type`,
      );
    }
    out[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
  }
  return out;
}

export const lmstudio: ClientAdapter = {
  id: "lmstudio",
  label: "LM Studio",
  defaultPath: "~/.lmstudio/mcp.json",

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".lmstudio")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "lmstudio";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseLmstudioServers(config, warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderLmstudioServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push("instructions: lmstudio system prompts are app-managed presets; skipped");
    }
    if (bundle.persona) warnings.push("persona: lmstudio has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: lmstudio has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: lmstudio has no SKILL.md mechanism; skipped");
    }
    return { files, warnings };
  },
};
