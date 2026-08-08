import path from "node:path";
import {
  AgentDef,
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
  mergeMcpRecords,
  parseCommonMcpEntry,
  planCommandsFlat,
  readAgentsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Amazon Q Developer CLI (q chat). MCP servers live under the `mcpServers`
 * key of ~/.aws/amazonq/mcp.json (the "legacy global" config every agent can
 * opt into via useLegacyMcpJson; the built-in default agent does). `type` is
 * stdio or http (stdio may omit it); stdio uses command/args/env, remote uses
 * url/headers plus OAuth handled by the CLI; native `disabled` flag.
 *
 * Custom agents are JSON files under ~/.aws/amazonq/cli-agents/ (global) or
 * .amazonq/cli-agents/ (workspace); the filename stem is the agent name.
 * They convert to/from portable markdown agents: `description` maps to a
 * frontmatter line and `prompt` to the body; the remaining fields (tools,
 * allowedTools, mcpServers, hooks, ...) are amazonq-specific and are dropped
 * with per-field warnings rather than silently.
 *
 * Saved prompts are flat markdown files under ~/.aws/amazonq/prompts/ (global)
 * or .amazonq/prompts/ (project), invoked as @name or via /prompts.
 */
const MCP_REL = ".aws/amazonq/mcp.json";
const COMMANDS_DIR_REL = ".aws/amazonq/prompts";
const AGENTS_DIR_REL = ".aws/amazonq/cli-agents";

const CLIENT_KEYS = ["timeout", "oauth", "oauthScopes"] as const;

const AGENT_PORTABLE_FIELDS = ["name", "description", "prompt"];

export const AMAZONQ_AGENTS_EXPORT_WARNING =
  "agents: converted from amazonq agent JSON (description + prompt); amazonq-specific fields are dropped with per-field warnings";

export const AMAZONQ_AGENTS_IMPORT_WARNING =
  "agents: written as amazonq agent JSON (description + prompt only); review tools/allowedTools/mcpServers in the target agent after import";

function frontmatterLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

/** Convert one amazonq agent JSON file into a portable markdown agent. */
export function amazonqAgentFromJson(
  name: string,
  raw: string,
  file: string,
  warnings: string[],
): AgentDef | undefined {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    warnings.push(`agents:${file}: invalid JSON; not migrated`);
    return undefined;
  }
  if (!isRecord(data)) {
    warnings.push(`agents:${file}: not a JSON object; not migrated`);
    return undefined;
  }
  for (const key of Object.keys(data)) {
    if (!AGENT_PORTABLE_FIELDS.includes(key)) {
      warnings.push(
        `agents:${name}: amazonq agent field "${key}" has no portable equivalent; dropped`,
      );
    }
  }
  if (typeof data.name === "string" && data.name !== name) {
    warnings.push(
      `agents:${name}: agent "name" field (${data.name}) differs from the filename; amazonq derives the name from the filename, so the filename wins`,
    );
  }
  const prompt = typeof data.prompt === "string" ? data.prompt : undefined;
  const description = typeof data.description === "string" ? data.description : undefined;
  if (prompt === undefined && description === undefined) {
    warnings.push(`agents:${file}: agent has neither prompt nor description; not migrated`);
    return undefined;
  }
  let body = prompt ?? "";
  if (body && !body.endsWith("\n")) body += "\n";
  const content =
    description !== undefined
      ? `---\n${frontmatterLine("description", description)}\n---\n${body}`
      : body;
  return { name, content };
}

function parseFrontmatterDescription(line: string): string | undefined {
  const m = /^description:\s*(.+)$/.exec(line);
  if (!m?.[1]) return undefined;
  let value = m[1].trim();
  if (value.startsWith('"')) {
    try {
      value = JSON.parse(value) as string;
    } catch {
      value = value.replace(/^"|"$/g, "");
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }
  return value;
}

/** Convert a portable markdown agent into amazonq agent JSON content. */
export function amazonqAgentToJson(a: AgentDef, warnings: string[]): string {
  let description: string | undefined;
  let prompt = a.content;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(a.content);
  if (m) {
    const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
    const parsed = lines.map((l) => parseFrontmatterDescription(l));
    if (parsed.every((p) => p !== undefined)) {
      description = parsed.find((p) => p !== undefined);
      prompt = a.content.slice(m[0].length);
    } else {
      warnings.push(
        `agents:${a.name}: frontmatter has fields beyond description, which amazonq agent JSON cannot express; kept verbatim inside prompt`,
      );
    }
  }
  const record: Record<string, string> = {
    description: description ?? `Imported by agentmove from agent ${a.name}`,
    prompt,
  };
  return JSON.stringify(record, null, 2) + "\n";
}

/** Read every top-level agent JSON file under a cli-agents root (flat scan, like amazonq). */
export async function readAmazonqAgents(root: string, warnings: string[]): Promise<AgentDef[]> {
  const agents: AgentDef[] = [];
  if (!(await isDir(root))) return agents;
  for (const name of (await listDir(root)).sort()) {
    if (await isDir(path.join(root, name))) continue;
    if (!name.endsWith(".json")) continue;
    const raw = await readText(path.join(root, name));
    if (raw === undefined) continue;
    const agent = amazonqAgentFromJson(name.slice(0, -".json".length), raw, name, warnings);
    if (agent) agents.push(agent);
  }
  return agents;
}

/** Plan amazonq agent JSON writes into a flat cli-agents root (nested names flattened). */
export function planAmazonqAgents(
  agents: AgentDef[],
  rootRel: string,
  warnings: string[],
): FilePlan[] {
  const plans: FilePlan[] = [];
  const used = new Set<string>();
  for (const a of agents) {
    let name = a.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(
        `agents:${a.name}: amazonq only discovers top-level agent files; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`agents:${a.name}: name collides with another agent after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({ path: `${rootRel}/${name}.json`, content: amazonqAgentToJson(a, warnings) });
  }
  return plans;
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseAmazonqServers(
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
          warnings.push(`mcp:${name}: amazonq ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderAmazonqServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const src: McpServer = { ...s, enabled: undefined };
    if (src.transport === "sse") {
      warnings.push(`mcp:${s.name}: amazonq has no sse transport type; written as http (the CLI falls back to SSE on handshake)`);
      src.transport = "http";
    }
    const entry = renderCommonMcpEntry(src, true);
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

export const amazonq: ClientAdapter = {
  id: "amazonq",
  label: "Amazon Q Developer CLI",
  defaultPath: "~/.aws/amazonq (mcp.json + prompts/ + cli-agents/)",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".aws/amazonq")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "amazonq";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseAmazonqServers(config, warnings);
    bundle.commands = await readAgentsDir(path.join(home, COMMANDS_DIR_REL), ".md");
    bundle.agents = await readAmazonqAgents(path.join(home, AGENTS_DIR_REL), warnings);
    if (bundle.agents.length) warnings.push(AMAZONQ_AGENTS_EXPORT_WARNING);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAmazonqServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: amazonq user-level context lives in agent JSON files (cli-agents/); use --project to write AmazonQ.md",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: amazonq has no persona file; skipped (use --project for AmazonQ.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: amazonq /knowledge store is app-managed; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: amazonq has no SKILL.md mechanism; skipped");
    }
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, COMMANDS_DIR_REL, "amazonq", warnings));
      warnings.push(
        "commands: saved prompts are invoked as @name in q chat; argument placeholders are client-specific and copied as-is",
      );
    }
    if (bundle.agents.length) {
      files.push(...planAmazonqAgents(bundle.agents, AGENTS_DIR_REL, warnings));
      warnings.push(AMAZONQ_AGENTS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};
