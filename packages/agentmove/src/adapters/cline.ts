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
  mergeMcpRecords,
  parseCommonMcpEntry,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Cline (CLI + VS Code extension). The CLI reads MCP servers from
 * ~/.cline/data/settings/cline_mcp_settings.json; global rules live in
 * ~/Documents/Cline/Rules/*.md (workspace rules are .clinerules/, handled by
 * the project adapter). Remote servers use `url` with `type` of
 * "streamableHttp" or "sse" (a missing type means legacy sse).
 */
const MCP_REL = ".cline/data/settings/cline_mcp_settings.json";
const RULES_REL = "Documents/Cline/Rules";

async function readMcpConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, MCP_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

/** Map Cline's transport spelling to the portable one before common parsing. */
function normalizeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out = { ...entry };
  if (out.type === "streamableHttp") out.type = "http";
  else if (typeof out.url === "string" && out.type === undefined) out.type = "sse";
  return out;
}

export async function readRulesDir(dir: string): Promise<string | undefined> {
  if (!(await isDir(dir))) return undefined;
  const parts: string[] = [];
  for (const name of (await listDir(dir)).sort()) {
    if (!name.endsWith(".md") && !name.endsWith(".txt")) continue;
    const content = await readText(path.join(dir, name));
    if (content?.trim()) parts.push(`<!-- ${name} -->\n${content.trim()}`);
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const cline: ClientAdapter = {
  id: "cline",
  label: "Cline",
  defaultPath: "~/.cline + ~/Documents/Cline/Rules",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".cline"))) ||
      (await isDir(path.join(home, RULES_REL)))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cline";

    const config = await readMcpConfig(home);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, normalizeEntry(entry), warnings);
      if (!s) continue;
      if (isRecord(entry) && entry.disabled === true) s.enabled = false;
      servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readRulesDir(path.join(home, RULES_REL));
    warnings.push(
      "cline VS Code extension keeps its own MCP settings copy in VS Code globalStorage; " +
        "only the CLI settings file (~/.cline) and global rules are migrated",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readMcpConfig(home);
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.cwd) warnings.push(`mcp:${s.name}: cline does not support cwd; dropped`);
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      if (s.transport === "http") entry.type = "streamableHttp";
      else if (s.transport === "sse") entry.type = "sse";
      if (s.enabled === false) entry.disabled = true;
      mcpServers[s.name] = entry;
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
        "persona: cline has no persona file; appended to a global rules file (approximated)",
      );
    }
    if (parts.length) {
      files.push({
        path: `${RULES_REL}/agentmove-imported.md`,
        content: parts.join("\n\n") + "\n",
      });
    }

    if (bundle.memory.length) {
      warnings.push("memory: cline has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: cline has no SKILL.md mechanism; skipped (consider converting to rules manually)");
    }
    return { files, warnings };
  },
};
