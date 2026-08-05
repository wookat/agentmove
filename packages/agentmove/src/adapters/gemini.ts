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
import { mergeMcpRecords, parseCommonMcpEntry, renderCommonMcpEntry } from "./shared.js";

const SETTINGS_REL = ".gemini/settings.json";
const CONTEXT_REL = ".gemini/GEMINI.md";
const MEMORY_HEADING = "## Gemini Added Memories";

function splitContext(content: string): { instructions?: string; memories: string[] } {
  const idx = content.indexOf(MEMORY_HEADING);
  if (idx === -1) return { instructions: content, memories: [] };
  const before = content.slice(0, idx).trimEnd();
  const after = content.slice(idx + MEMORY_HEADING.length);
  const end = after.indexOf("\n## ");
  const section = end === -1 ? after : after.slice(0, end);
  const rest = end === -1 ? "" : after.slice(end);
  const memories = section
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  const instructions = (before + rest).trim();
  return { instructions: instructions || undefined, memories };
}

export const gemini: ClientAdapter = {
  id: "gemini",
  label: "Gemini CLI",
  defaultPath: "~/.gemini",

  async detect(home) {
    return (await exists(path.join(home, SETTINGS_REL))) || (await isDir(path.join(home, ".gemini")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "gemini";

    const settingsFile = path.join(home, SETTINGS_REL);
    const raw = await readText(settingsFile);
    let settings: Record<string, unknown> = {};
    if (raw !== undefined) {
      const data = parseFile<unknown>(settingsFile, raw, JSON.parse);
      if (isRecord(data)) settings = data;
    }
    bundle.config.raw = settings;
    const serversObj = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    const context = await readText(path.join(home, CONTEXT_REL));
    if (context) {
      const { instructions, memories } = splitContext(context);
      bundle.instructions = instructions;
      bundle.memory = memories.map((content) => ({
        content,
        source: "GEMINI.md#gemini-added-memories",
        kind: "long-term" as const,
      }));
    }
    if (await isDir(path.join(home, ".gemini/extensions"))) {
      warnings.push("gemini extensions are not exported in v0 (install them on the target machine instead)");
    }
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const settingsFile = path.join(home, SETTINGS_REL);
    const raw = await readText(settingsFile);
    let settings: Record<string, unknown> = {};
    if (raw !== undefined) {
      const data = parseFile<unknown>(settingsFile, raw, JSON.parse);
      if (isRecord(data)) settings = data;
    }
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: gemini has no disabled flag; server emitted as enabled`);
      }
      mcpServers[s.name] = renderCommonMcpEntry(s, false);
    }
    const existing = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    settings.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    files.push({ path: SETTINGS_REL, content: JSON.stringify(settings, null, 2) + "\n" });

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: gemini has no persona file; appended to ~/.gemini/GEMINI.md (approximated)");
    }
    if (bundle.memory.length) {
      parts.push(
        `${MEMORY_HEADING}\n` +
          bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, " ")}`).join("\n"),
      );
    }
    if (parts.length) files.push({ path: CONTEXT_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.skills.length) {
      warnings.push("skills: gemini has no SKILL.md mechanism; skipped (consider a gemini extension)");
    }
    return { files, warnings };
  },
};
