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
 * Kiro (AWS). MCP servers live under the `mcpServers` key of
 * ~/.kiro/settings/mcp.json (stdio: command/args/env, remote: url/headers,
 * native `disabled` flag). Instructions are markdown steering files under
 * ~/.kiro/steering/ (AGENTS.md is supported there per the AGENTS.md standard);
 * skills follow the open Agent Skills standard under ~/.kiro/skills/.
 */
const MCP_REL = ".kiro/settings/mcp.json";
const STEERING_REL = ".kiro/steering";
const AGENTS_REL = ".kiro/steering/AGENTS.md";
const SKILLS_REL = ".kiro/skills";
const AGENTS_DIR_REL = ".kiro/agents";

const CLIENT_KEYS = ["autoApprove", "disabledTools", "oauth", "oauthScopes"] as const;

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseKiroServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (entry[key] !== undefined) {
          warnings.push(`mcp:${name}: kiro ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export async function warnKiroJsonAgents(root: string, warnings: string[]): Promise<void> {
  if (!(await isDir(root))) return;
  const json = (await listDir(root)).filter((f) => f.endsWith(".json")).sort();
  if (json.length) {
    warnings.push(
      `agents: ${json.length} kiro JSON agent config(s) not exported (${json.join(", ")}); only markdown agents migrate — kiro supports the same fields in markdown`,
    );
  }
}

export function renderKiroServers(bundle: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

async function readSteering(
  root: string,
  warnings: string[],
): Promise<string | undefined> {
  const agents = await readText(path.join(root, "AGENTS.md"));
  const parts: string[] = [];
  if (agents) parts.push(agents.trim());
  if (await isDir(root)) {
    const others = (await listDir(root)).filter((f) => f.endsWith(".md") && f !== "AGENTS.md").sort();
    for (const f of others) {
      const content = await readText(path.join(root, f));
      if (content?.trim()) parts.push(`<!-- steering: ${f} -->\n${content.trim()}`);
    }
    if (others.length) {
      warnings.push(
        "instructions: kiro steering files merged into one document; inclusion-mode front matter is kept verbatim but only applies in kiro",
      );
    }
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const kiro: ClientAdapter = {
  id: "kiro",
  label: "Kiro",
  defaultPath: "~/.kiro (settings/mcp.json + steering/ + skills/ + agents/)",
  supportsAgents: true,

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".kiro")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kiro";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseKiroServers(config, warnings);
    bundle.instructions = await readSteering(path.join(home, STEERING_REL), warnings);
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.agents = await readAgentsDir(path.join(home, AGENTS_DIR_REL), ".md");
    await warnKiroJsonAgents(path.join(home, AGENTS_DIR_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderKiroServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: kiro has no persona file; appended to ~/.kiro/steering/AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: kiro has no durable memory store; skipped (use steering files for persistent context)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/permissions) are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};
