import path from "node:path";
import JSON5 from "json5";
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
 * Zed. MCP servers live under the `context_servers` key of
 * ~/.config/zed/settings.json (JSONC — comments allowed); personal
 * instructions are ~/.config/zed/AGENTS.md. Local servers require `args`
 * (Zed's schema rejects a bare `command`), remote servers use `url` +
 * `headers`.
 */
const SETTINGS_REL = ".config/zed/settings.json";
const AGENTS_REL = ".config/zed/AGENTS.md";
const SKILLS_REL = ".agents/skills";

async function readSettings(
  home: string,
  warnings: string[],
): Promise<Record<string, unknown>> {
  const file = path.join(home, SETTINGS_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
  if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
    warnings.push("zed settings.json: existing JSONC comments are not preserved on rewrite");
  }
  return isRecord(data) ? data : {};
}

export const zed: ClientAdapter = {
  id: "zed",
  label: "Zed",
  defaultPath: "~/.config/zed/settings.json (context_servers) + ~/.agents/skills/",

  async detect(home) {
    return (
      (await exists(path.join(home, SETTINGS_REL))) ||
      (await isDir(path.join(home, ".config/zed")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "zed";

    const settings = await readSettings(home, []);
    bundle.config.raw = settings;
    const serversObj = isRecord(settings.context_servers) ? settings.context_servers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    warnings.push(
      "zed Rules Library entries are app-managed and not exported; " +
        "personal instructions live in ~/.config/zed/AGENTS.md",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const settings = await readSettings(home, warnings);
    const contextServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: zed has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: zed does not support cwd; dropped`);
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      if (typeof entry.command === "string" && entry.args === undefined) {
        entry.args = []; // Zed's schema requires args for stdio servers
      }
      contextServers[s.name] = entry;
    }
    const existing = isRecord(settings.context_servers) ? settings.context_servers : {};
    settings.context_servers = mergeMcpRecords(
      existing,
      contextServers,
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: SETTINGS_REL, content: JSON.stringify(settings, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: zed has no persona file; appended to ~/.config/zed/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      warnings.push("memory: zed has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
