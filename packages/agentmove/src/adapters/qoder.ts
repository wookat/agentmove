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
import { isDir, readText } from "../fsutil.js";
import {
  appendSections,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDir,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Qoder CLI (Alibaba). User-scoped MCP servers live under the `mcpServers`
 * key of ~/.qoder/settings.json (a general settings file whose other keys
 * must be preserved). Entries use the common notation: `type` is optional
 * (stdio default) with stdio/sse/http/ws supported natively; stdio uses
 * command/args/env, remote uses url/headers. There is no per-server disabled
 * flag (only `mcp.allowed`/`mcp.excluded` allowlists, which are preserved as
 * plain settings). User memory is ~/.qoder/AGENTS.md and user skills follow
 * the open Agent Skills standard under ~/.qoder/skills/. Custom subagents
 * are markdown files with YAML frontmatter under ~/.qoder/agents/ (user)
 * and .qoder/agents/ (project; project overrides user on name conflicts).
 */
const SETTINGS_REL = ".qoder/settings.json";
const MEMORY_REL = ".qoder/AGENTS.md";
const SKILLS_REL = ".qoder/skills";
const AGENTS_DIR_REL = ".qoder/agents";

export const QODER_AGENTS_WARNING =
  "agents: frontmatter fields (tools/model/skills/mcpServers) are client-specific and copied as-is; review after import";

export async function readQoderSettings(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

export function parseQoderServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (isRecord(entry) && entry.type === "ws") {
      warnings.push(`mcp:${name}: qoder ws (WebSocket) transport has no portable equivalent; skipped`);
      continue;
    }
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry) && entry.isProxy !== undefined) {
      warnings.push(`mcp:${name}: qoder isProxy is client-specific; not migrated`);
    }
    servers.push(s);
  }
  return servers;
}

export function renderQoderServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: qoder has no disabled flag; imported as enabled`);
    }
    if (s.cwd) warnings.push(`mcp:${s.name}: qoder does not support cwd; dropped`);
    servers[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, true);
  }
  return servers;
}

export async function planQoderMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readQoderSettings(file);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers = renderQoderServers(bundle, warnings);
  config.mcpServers = mergeMcpRecords(existing, servers, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const qoder: ClientAdapter = {
  id: "qoder",
  label: "Qoder CLI",
  defaultPath: "~/.qoder (settings.json + AGENTS.md + skills/ + agents/)",
  supportsAgents: true,

  async detect(home) {
    return isDir(path.join(home, ".qoder"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "qoder";

    const config = await readQoderSettings(path.join(home, SETTINGS_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseQoderServers(config, warnings);
    bundle.instructions = await readText(path.join(home, MEMORY_REL));
    if (await isDir(path.join(home, ".qoder/rules"))) {
      warnings.push(
        "instructions: ~/.qoder/rules/**/*.md are client-specific rule files; not exported (only AGENTS.md is)",
      );
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.agents = await readAgentsDir(path.join(home, AGENTS_DIR_REL), ".md");
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planQoderMcp(
        bundle,
        path.join(home, SETTINGS_REL),
        SETTINGS_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        "persona: qoder has no persona file; appended to ~/.qoder/AGENTS.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: MEMORY_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: qoder auto-memory is app-managed; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(QODER_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};
