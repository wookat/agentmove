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
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Warp (warp.dev terminal / agent platform). Warp-managed MCP servers live in
 * ~/.warp/.mcp.json (project-scoped: {repo}/.warp/.mcp.json). Entries have no
 * `type` field: stdio uses command/args/env plus optional working_directory,
 * remote servers use url (transport is auto-negotiated). Warp recognizes a
 * few wrapper keys; `mcpServers` is preferred and the existing one is kept on
 * merge. Global rules live in Warp Drive (app-managed); project rules are
 * AGENTS.md (or legacy WARP.md) at the repo root.
 */
const MCP_REL = ".warp/.mcp.json";
const SKILLS_REL = ".warp/skills";

const WRAPPER_KEYS = ["mcpServers", "mcp_servers", "servers"] as const;

export async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function warpWrapperKey(config: Record<string, unknown>): string {
  for (const key of WRAPPER_KEYS) {
    if (isRecord(config[key])) return key;
  }
  return "mcpServers";
}

export function parseWarpServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const wrapped = config[warpWrapperKey(config)];
  const serversObj = isRecord(wrapped) ? wrapped : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry) && typeof entry.working_directory === "string") {
      s.cwd = entry.working_directory;
    }
    servers.push(s);
  }
  return servers;
}

export function renderWarpServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: warp has no disabled flag; server emitted as enabled`);
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: warp url servers auto-negotiate transport; sse written as a plain url entry`,
      );
    }
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
    if (s.transport === "stdio" && s.cwd) {
      delete entry.cwd;
      entry.working_directory = s.cwd;
    }
    out[s.name] = entry;
  }
  return out;
}

export const warp: ClientAdapter = {
  id: "warp",
  label: "Warp",
  defaultPath: "~/.warp (.mcp.json + skills/)",

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".warp")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "warp";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseWarpServers(config, warnings);
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const key = warpWrapperKey(config);
    const wrapped = config[key];
    const existing = isRecord(wrapped) ? wrapped : {};
    config[key] = mergeMcpRecords(
      existing,
      renderWarpServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: warp global rules live in Warp Drive (app-managed); use --project to write AGENTS.md",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: warp has no persona file; skipped (use --project for AGENTS.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: warp has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
