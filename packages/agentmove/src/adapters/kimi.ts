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
import { isDir, readText } from "../fsutil.js";
import {
  mergeAgentLists,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDirRecursive,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Kimi Code CLI (Moonshot AI). MCP servers live under the `mcpServers` key of
 * ~/.kimi-code/mcp.json: entries with a `command` are stdio servers
 * (args/env/cwd supported), entries with a `url` and no `transport` are HTTP,
 * and legacy SSE servers set `transport: "sse"` explicitly. Every entry takes
 * a native `enabled` flag plus client-specific fields (bearerTokenEnvVar,
 * startupTimeoutMs, toolTimeoutMs, enabledTools, disabledTools). Global
 * instructions are ~/.kimi-code/AGENTS.md and user skills follow the Agent
 * Skills standard under ~/.kimi-code/skills/ plus the generic shared root
 * ~/.agents/skills/ (project: .kimi-code/skills/ + .agents/skills/); on a
 * duplicate normalized (lowercased) name the brand root wins (upstream
 * scanner priority is first-wins in brand-then-generic order). Custom agents
 * are markdown files with YAML frontmatter, discovered recursively under
 * ~/.kimi-code/agents/ and the generic shared root ~/.agents/agents/ (user)
 * plus .kimi-code/agents/ and .agents/agents/ (project); imports write only
 * the brand-native directory to avoid double-ownership of the shared root.
 */
const CONFIG_DIR_REL = ".kimi-code";
const MCP_REL = ".kimi-code/mcp.json";
const AGENTS_REL = ".kimi-code/AGENTS.md";
const SKILLS_REL = ".kimi-code/skills";
const GENERIC_SKILLS_REL = ".agents/skills";
const AGENTS_DIR_REL = ".kimi-code/agents";
const SHARED_AGENTS_DIR_REL = ".agents/agents";

export const KIMI_AGENTS_WARNING =
  "agents: frontmatter fields (tools/disallowedTools/subagents/model_preference/override) are client-specific and copied as-is; review after import";

const CLIENT_SPECIFIC_FIELDS = [
  "bearerTokenEnvVar",
  "startupTimeoutMs",
  "toolTimeoutMs",
  "enabledTools",
  "disabledTools",
] as const;

export async function readKimiSkills(
  brandRoot: string,
  genericRoot: string,
  warnings: string[],
): Promise<Skill[]> {
  const skills = await readSkillsDir(brandRoot, warnings);
  const names = new Set(skills.map((s) => s.name.toLowerCase()));
  for (const skill of await readSkillsDir(genericRoot, warnings)) {
    const key = skill.name.toLowerCase();
    if (names.has(key)) {
      warnings.push(
        `skills:${skill.name}: .agents/skills copy shadowed by the .kimi-code/skills version (kimi loads the brand root first); the .kimi-code/skills version is exported`,
      );
      continue;
    }
    names.add(key);
    skills.push(skill);
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function readKimiMcp(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

/** Normalize a Kimi entry into the common shape parseCommonMcpEntry understands. */
export function fromKimiEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out: Record<string, unknown> = { ...entry };
  if (out.transport === "sse") out.type = "sse";
  delete out.transport;
  return out;
}

/** Render a portable server into Kimi's spelling. */
export function toKimiEntry(s: McpServer): Record<string, unknown> {
  const out = renderCommonMcpEntry(s, false);
  if (s.transport === "sse") out.transport = "sse";
  if (s.enabled === false) out.enabled = false;
  return out;
}

export function parseKimiServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, fromKimiEntry(entry), warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.enabled === false) s.enabled = false;
      for (const field of CLIENT_SPECIFIC_FIELDS) {
        if (entry[field] !== undefined) {
          warnings.push(`mcp:${name}: kimi ${field} is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export async function planKimiMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readKimiMcp(file);
  const rendered: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    rendered[s.name] = toKimiEntry(s);
  }
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(existing, rendered, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const kimi: ClientAdapter = {
  id: "kimi",
  label: "Kimi Code CLI",
  defaultPath: "~/.kimi-code (mcp.json + AGENTS.md + skills/ + agents/) + ~/.agents/skills",
  supportsAgents: true,

  async detect(home) {
    return isDir(path.join(home, CONFIG_DIR_REL));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kimi";

    const config = await readKimiMcp(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseKimiServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readKimiSkills(
      path.join(home, SKILLS_REL),
      path.join(home, GENERIC_SKILLS_REL),
      warnings,
    );
    bundle.agents = mergeAgentLists(
      await readAgentsDirRecursive(path.join(home, SHARED_AGENTS_DIR_REL), ".md"),
      await readAgentsDirRecursive(path.join(home, AGENTS_DIR_REL), ".md"),
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planKimiMcp(
        bundle,
        path.join(home, MCP_REL),
        MCP_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: kimi has no persona file; appended to ~/.kimi-code/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      warnings.push("memory: kimi has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, AGENTS_DIR_REL, ".md"));
      warnings.push(KIMI_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};
