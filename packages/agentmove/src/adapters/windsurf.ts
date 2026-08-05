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
import { mergeMcpRecords, parseCommonMcpEntry, renderCommonMcpEntry, touchesMcpConfig } from "./shared.js";

const MCP_REL = ".codeium/windsurf/mcp_config.json";
const RULES_REL = ".codeium/windsurf/memories/global_rules.md";

async function readMcpConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, MCP_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

/** Windsurf uses `serverUrl` for remote servers; normalize to `url` before parsing. */
function normalizeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  if (typeof entry.serverUrl === "string" && entry.url === undefined) {
    const { serverUrl, ...rest } = entry;
    return { ...rest, url: serverUrl };
  }
  return entry;
}

export const windsurf: ClientAdapter = {
  id: "windsurf",
  label: "Windsurf",
  defaultPath: "~/.codeium/windsurf (memories are app-managed)",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".codeium/windsurf")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "windsurf";

    const config = await readMcpConfig(home);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, normalizeEntry(entry), warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, RULES_REL));
    warnings.push(
      "windsurf Cascade memories are app-managed and not exported; " +
        "durable rules live in global_rules.md (exported as instructions)",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readMcpConfig(home);
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: windsurf has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: windsurf does not support cwd; dropped`);
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      if (typeof entry.url === "string") {
        const { url, ...rest } = entry;
        mcpServers[s.name] = { ...rest, serverUrl: url };
      } else {
        mcpServers[s.name] = entry;
      }
    }
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: windsurf has no persona file; appended to global_rules.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: RULES_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      warnings.push("memory: windsurf Cascade memories are app-managed and cannot be imported; skipped");
    }
    if (bundle.skills.length) {
      warnings.push("skills: windsurf has no SKILL.md mechanism; skipped (consider converting to rules manually)");
    }
    return { files, warnings };
  },
};
