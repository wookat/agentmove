import path from "node:path";
import {
  Bundle,
  ClientAdapter,
  ClientId,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import { appendSections, mergeMcpRecords, parseCommonMcpEntry, planSkills, readSkillsDir, renderCommonMcpEntry, touchesMcpConfig } from "./shared.js";

export interface ClaudeStyleLayout {
  id: ClientId;
  label: string;
  defaultPath: string;
  /** Directory prefix (relative to home, "" for the standalone CLI). */
  root: string;
}

/**
 * Claude Code stores its config as `.claude.json` + a `.claude/` directory
 * under a config root. The standalone CLI uses the home directory as root;
 * Xcode's bundled Claude Agent uses its own root under ~/Library.
 */
export function makeClaudeStyleAdapter(layout: ClaudeStyleLayout): ClientAdapter {
  const { id, root } = layout;
  const rel = (p: string) => (root ? `${root}/${p}` : p);
  const tilde = root ? `~/${root}` : "~";
  const MCP_REL = rel(".claude.json");
  const MD_REL = rel(".claude/CLAUDE.md");
  const SKILLS_REL = rel(".claude/skills");

  async function readUserConfig(home: string): Promise<Record<string, unknown>> {
    const file = path.join(home, MCP_REL);
    const raw = await readText(file);
    if (raw === undefined) return {};
    const data = parseFile<unknown>(file, raw, JSON.parse);
    return isRecord(data) ? data : {};
  }

  return {
    id,
    label: layout.label,
    defaultPath: layout.defaultPath,

    async detect(home) {
      return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, rel(".claude"))));
    },

    async exportBundle(home): Promise<ExportResult> {
      const warnings: string[] = [];
      const bundle: Bundle = emptyBundle();
      bundle.manifest.exportedFrom = id;

      const config = await readUserConfig(home);
      bundle.config.raw = config;
      const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
      const servers: McpServer[] = [];
      for (const [name, entry] of Object.entries(serversObj)) {
        const s = parseCommonMcpEntry(name, entry, warnings);
        if (s) servers.push(s);
      }
      bundle.mcpServers = servers;

      bundle.instructions = await readText(path.join(home, MD_REL));
      bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
      warnings.push(
        `${id} auto memory is session/project-scoped and not exported in v0; ` +
          "durable notes should live in CLAUDE.md (exported as instructions)",
      );
      return { bundle, warnings };
    },

    async planImport(bundle, home, opts): Promise<ImportResult> {
      const warnings: string[] = [];
      const files: FilePlan[] = [];

      const config = await readUserConfig(home);
      const mcpServers: Record<string, unknown> = {};
      for (const s of bundle.mcpServers) {
        if (s.enabled === false) {
          warnings.push(`mcp:${s.name}: ${id} has no disabled flag; server emitted as enabled`);
        }
        mcpServers[s.name] = renderCommonMcpEntry(s, true);
      }
      const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
      config.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
      if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
        files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
      }

      const sections: { title: string; body: string }[] = [];
      if (bundle.persona) {
        sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
        warnings.push(`persona: ${id} has no persona file; appended to ${tilde}/.claude/CLAUDE.md (approximated)`);
      }
      if (bundle.memory.length) {
        sections.push({
          title: "memory",
          body: bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, "\n  ")}`).join("\n"),
        });
        warnings.push(`memory: ${id} has no importable memory store; appended to ${tilde}/.claude/CLAUDE.md (approximated)`);
      }
      const instructions = appendSections(bundle.instructions, sections);
      if (instructions) files.push({ path: MD_REL, content: instructions });

      files.push(...planSkills(bundle.skills, SKILLS_REL));
      return { files, warnings };
    },
  };
}

export const claudeCode: ClientAdapter = makeClaudeStyleAdapter({
  id: "claude-code",
  label: "Claude Code",
  defaultPath: "~/.claude + ~/.claude.json",
  root: "",
});
