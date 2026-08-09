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
  Skill,
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
 * Amp (Sourcegraph). User settings live in ~/.config/amp/settings.json; MCP
 * servers sit under the flat `"amp.mcpServers"` key with the common
 * command/args/env (local) or url/headers (remote) fields. Global
 * instructions are ~/.config/amp/AGENTS.md. User-wide skills load from three
 * roots in priority order — ~/.config/agents/skills/, ~/.agents/skills/, then
 * ~/.config/amp/skills/ — with the first skill of a given name winning.
 * Claude-compatible roots (~/.claude/skills/, plugin cache) that amp also
 * scans belong to the claude adapters and are not read here.
 */
const SETTINGS_REL = ".config/amp/settings.json";
const AGENTS_REL = ".config/amp/AGENTS.md";
const SKILLS_REL = ".agents/skills";
const SKILLS_ROOTS = [".config/agents/skills", ".agents/skills", ".config/amp/skills"];
const MCP_KEY = "amp.mcpServers";

/** Merge amp's user skill roots in priority order; first name wins. */
export async function readAmpSkills(home: string, warnings: string[]): Promise<Skill[]> {
  const skills: Skill[] = [];
  const winner = new Map<string, string>();
  for (const rootRel of SKILLS_ROOTS) {
    for (const skill of await readSkillsDir(path.join(home, rootRel), warnings)) {
      const winnerRoot = winner.get(skill.name);
      if (winnerRoot !== undefined) {
        warnings.push(
          `skills:${skill.name}: ~/${rootRel} copy shadowed by ~/${winnerRoot}; the higher-priority version is exported`,
        );
        continue;
      }
      winner.set(skill.name, rootRel);
      skills.push(skill);
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

async function readSettings(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, SETTINGS_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function renderAmpEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  if (s.cwd) warnings.push(`mcp:${s.name}: amp does not support cwd; dropped`);
  if (s.enabled === false) {
    warnings.push(`mcp:${s.name}: amp has no disabled flag; server emitted as enabled`);
  }
  if (s.transport === "sse") {
    warnings.push(`mcp:${s.name}: amp remote servers use a plain url (no transport field)`);
  }
  return renderCommonMcpEntry({ ...s, cwd: undefined }, false);
}

export const amp: ClientAdapter = {
  id: "amp",
  label: "Amp",
  defaultPath:
    "~/.config/amp (settings.json + AGENTS.md) + ~/.config/agents/skills + ~/.agents/skills + ~/.config/amp/skills",

  async detect(home) {
    return (
      (await exists(path.join(home, SETTINGS_REL))) ||
      (await isDir(path.join(home, ".config/amp")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "amp";

    const settings = await readSettings(home);
    bundle.config.raw = settings;
    const serversObj = isRecord(settings[MCP_KEY]) ? (settings[MCP_KEY] as Record<string, unknown>) : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readAmpSkills(home, warnings);

    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const settings = await readSettings(home);
    const imported: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      imported[s.name] = renderAmpEntry(s, warnings);
    }
    const existing = isRecord(settings[MCP_KEY])
      ? (settings[MCP_KEY] as Record<string, unknown>)
      : {};
    settings[MCP_KEY] = mergeMcpRecords(existing, imported, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: SETTINGS_REL, content: JSON.stringify(settings, null, 2) + "\n" });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        `persona: amp has no persona file; appended to ~/${AGENTS_REL} (approximated)`,
      );
    }
    if (bundle.memory.length) {
      sections.push({
        title: "memory",
        body: bundle.memory.map((e) => `- ${e.content.trim()}`).join("\n"),
      });
      warnings.push(
        `memory: amp has no durable memory store; appended to ~/${AGENTS_REL} (approximated)`,
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({
        path: AGENTS_REL,
        content: appendSections(bundle.instructions, sections),
      });
    }

    files.push(...planSkills(bundle.skills, SKILLS_REL));
    for (const skill of bundle.skills) {
      if (await isDir(path.join(home, ".config/agents/skills", skill.name))) {
        warnings.push(
          `skills:${skill.name}: an existing ~/.config/agents/skills copy has higher priority in amp and will shadow the imported ~/${SKILLS_REL} version`,
        );
      }
    }

    return { files, warnings };
  },
};
