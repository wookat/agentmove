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
 * Qwen Code (a Gemini CLI fork). MCP servers live under the `mcpServers` key
 * of ~/.qwen/settings.json; context/instructions are ~/.qwen/QWEN.md with
 * saved memories under a "## Qwen Added Memories" section; skills are native
 * SKILL.md directories under ~/.qwen/skills/.
 */
const SETTINGS_REL = ".qwen/settings.json";
const CONTEXT_REL = ".qwen/QWEN.md";
const SKILLS_REL = ".qwen/skills";
const MEMORY_HEADING = "## Qwen Added Memories";

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

async function readSettings(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, SETTINGS_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export const qwen: ClientAdapter = {
  id: "qwen",
  label: "Qwen Code",
  defaultPath: "~/.qwen (settings.json + QWEN.md + skills/)",

  async detect(home) {
    return (await exists(path.join(home, SETTINGS_REL))) || (await isDir(path.join(home, ".qwen")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "qwen";

    const settings = await readSettings(home);
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
        source: "QWEN.md#qwen-added-memories",
        kind: "long-term" as const,
      }));
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const settings = await readSettings(home);
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: qwen has no disabled flag; server emitted as enabled`);
      }
      mcpServers[s.name] = renderCommonMcpEntry(s, false);
    }
    const existing = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    settings.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: SETTINGS_REL, content: JSON.stringify(settings, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: qwen has no persona file; appended to ~/.qwen/QWEN.md (approximated)");
    }
    if (bundle.memory.length) {
      parts.push(
        `${MEMORY_HEADING}\n` +
          bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, " ")}`).join("\n"),
      );
    }
    if (parts.length) files.push({ path: CONTEXT_REL, content: parts.join("\n\n") + "\n" });

    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
