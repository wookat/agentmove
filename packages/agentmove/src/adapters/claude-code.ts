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
import { appendSections, mergeMcpRecords, parseCommonMcpEntry, planSkills, readSkillsDir, renderCommonMcpEntry, touchesMcpConfig } from "./shared.js";

const MCP_REL = ".claude.json";

async function readUserConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, MCP_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export const claudeCode: ClientAdapter = {
  id: "claude-code",
  label: "Claude Code",
  defaultPath: "~/.claude + ~/.claude.json",

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".claude")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "claude-code";

    const config = await readUserConfig(home);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, ".claude/CLAUDE.md"));
    bundle.skills = await readSkillsDir(path.join(home, ".claude/skills"), warnings);
    warnings.push(
      "claude-code auto memory is session/project-scoped and not exported in v0; " +
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
        warnings.push(`mcp:${s.name}: claude-code has no disabled flag; server emitted as enabled`);
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
      warnings.push("persona: claude-code has no persona file; appended to ~/.claude/CLAUDE.md (approximated)");
    }
    if (bundle.memory.length) {
      sections.push({
        title: "memory",
        body: bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, "\n  ")}`).join("\n"),
      });
      warnings.push("memory: claude-code has no importable memory store; appended to ~/.claude/CLAUDE.md (approximated)");
    }
    const instructions = appendSections(bundle.instructions, sections);
    if (instructions) files.push({ path: ".claude/CLAUDE.md", content: instructions });

    files.push(...planSkills(bundle.skills, ".claude/skills"));
    return { files, warnings };
  },
};
