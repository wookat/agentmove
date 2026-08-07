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
import { exists, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Claude Desktop. Migratable surfaces are claude_desktop_config.json with the
 * common `mcpServers` map (stdio command/args/env) and personal Agent Skills
 * in ~/.claude/skills, which Desktop local sessions load (shared with Claude
 * Code). The config location is platform-specific: ~/Library/Application
 * Support/Claude (macOS), %APPDATA%\Claude (Windows), ~/.config/Claude
 * (unofficial Linux builds).
 */
const SKILLS_REL = ".claude/skills";

const CANDIDATE_RELS = [
  "Library/Application Support/Claude/claude_desktop_config.json",
  "AppData/Roaming/Claude/claude_desktop_config.json",
  ".config/Claude/claude_desktop_config.json",
];

function platformDefaultRel(): string {
  if (process.platform === "darwin") return CANDIDATE_RELS[0]!;
  if (process.platform === "win32") return CANDIDATE_RELS[1]!;
  return CANDIDATE_RELS[2]!;
}

async function findConfigRel(home: string): Promise<string | undefined> {
  for (const rel of CANDIDATE_RELS) {
    if (await exists(path.join(home, rel))) return rel;
  }
  return undefined;
}

export const claudeDesktop: ClientAdapter = {
  id: "claude-desktop",
  label: "Claude Desktop",
  defaultPath:
    "~/Library/Application Support/Claude or %APPDATA%\\Claude (claude_desktop_config.json) + ~/.claude/skills/",

  async detect(home) {
    return (await findConfigRel(home)) !== undefined;
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "claude-desktop";

    const rel = await findConfigRel(home);
    let config: Record<string, unknown> = {};
    if (rel) {
      const file = path.join(home, rel);
      const raw = await readText(file);
      if (raw !== undefined) {
        const data = parseFile<unknown>(file, raw, JSON.parse);
        if (isRecord(data)) config = data;
      }
    }
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    warnings.push(
      "claude-desktop stores instructions/memory/projects inside the app; only MCP servers and skills migrate",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const rel = (await findConfigRel(home)) ?? platformDefaultRel();
    let config: Record<string, unknown> = {};
    const raw = await readText(path.join(home, rel));
    if (raw !== undefined) {
      const data = parseFile<unknown>(path.join(home, rel), raw, JSON.parse);
      if (isRecord(data)) config = data;
    }

    const imported: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: claude-desktop has no disabled flag; server emitted as enabled`);
      }
      if (s.transport !== "stdio") {
        warnings.push(
          `mcp:${s.name}: claude-desktop config supports stdio servers; remote server emitted with url for a proxy setup`,
        );
      }
      imported[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
    }
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(existing, imported, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push("instructions: claude-desktop has no instructions file; skipped");
    }
    if (bundle.persona) warnings.push("persona: claude-desktop has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: claude-desktop memory is app-managed; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push(
        "skills: written to ~/.claude/skills, a shared root also read by claude-code",
      );
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
