import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  AgentDef,
  asStringRecord,
  Bundle,
  ClientAdapter,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
  stringArgs,
} from "../model.js";
import { isDir, listDir, readText } from "../fsutil.js";
import { appendSections, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

/**
 * Vibe Code CLI (Mistral). MCP servers live in `[[mcp_servers]]` array-of-table
 * entries of ~/.vibe/config.toml; each entry carries its own `name` plus an
 * explicit `transport` ("stdio", "http", or "streamable-http"). Instructions
 * load from ~/.vibe/AGENTS.md and skills follow the Agent Skills standard
 * under ~/.vibe/skills/. Custom agents are TOML config-override profiles in
 * ~/.vibe/agents/ (flat, name = file stem); an agent's prompt text lives in a
 * separate ~/.vibe/prompts/<id>.md file referenced via the profile's
 * `system_prompt_id` override.
 */
const CONFIG_REL = ".vibe/config.toml";
const AGENTS_REL = ".vibe/AGENTS.md";
const SKILLS_REL = ".vibe/skills";
const AGENTS_DIR_REL = ".vibe/agents";
const PROMPTS_REL = ".vibe/prompts";

/** Profile metadata keys vibe pops before treating the rest as config overrides. */
const PROFILE_KEYS = ["display_name", "description", "safety", "agent_type"] as const;

/** Builtin agent names a custom profile of the same name would override. */
const BUILTIN_AGENTS = ["default", "plan", "accept-edits", "auto-approve", "explore", "lean"];

export const VIBE_AGENTS_EXPORT_WARNING =
  "agents: converted from vibe agent profile TOML (description + custom system prompt); vibe-specific overrides are dropped with per-field warnings";

export const VIBE_AGENTS_IMPORT_WARNING =
  "agents: written as vibe agent profile TOML with the body in ~/.vibe/prompts/<name>.md (referenced via system_prompt_id); review tool/permission overrides in the target profile after import";

/**
 * Read vibe custom agent profiles (flat *.toml glob, name = file stem, like
 * vibe's AgentManager). A profile with a `system_prompt_id` override that
 * resolves to a custom prompt markdown file exports that prompt as the agent
 * body; other overrides are vibe-specific config and dropped with warnings.
 */
export async function readVibeAgents(
  agentsRoot: string,
  promptsRoot: string,
  warnings: string[],
): Promise<AgentDef[]> {
  const agents: AgentDef[] = [];
  if (!(await isDir(agentsRoot))) return agents;
  for (const file of (await listDir(agentsRoot)).sort()) {
    if (!file.endsWith(".toml") || file === ".toml") continue;
    const raw = await readText(path.join(agentsRoot, file));
    if (raw === undefined) continue;
    let data: unknown;
    try {
      data = parseToml(raw);
    } catch {
      warnings.push(`agents:${file}: invalid TOML; not migrated`);
      continue;
    }
    if (!isRecord(data)) {
      warnings.push(`agents:${file}: not a TOML table; not migrated`);
      continue;
    }
    const name = file.slice(0, -".toml".length);
    const description = typeof data.description === "string" ? data.description.trim() : "";
    if (typeof data.display_name === "string") {
      warnings.push(`agents:${name}: vibe display_name has no portable equivalent; dropped`);
    }
    if (typeof data.safety === "string") {
      warnings.push(`agents:${name}: vibe safety level "${data.safety}" has no portable equivalent; dropped`);
    }
    if (typeof data.agent_type === "string" && data.agent_type !== "agent") {
      warnings.push(`agents:${name}: vibe agent_type "${data.agent_type}" has no portable equivalent; dropped`);
    }
    let body = "";
    const promptId = data.system_prompt_id;
    if (typeof promptId === "string") {
      const prompt =
        promptId.includes("/") || promptId.includes("\\")
          ? undefined
          : await readText(path.join(promptsRoot, `${promptId}.md`));
      if (prompt !== undefined) {
        body = prompt;
      } else {
        warnings.push(
          `agents:${name}: system_prompt_id "${promptId}" does not resolve to a custom prompt markdown file (builtin or missing); body not exported`,
        );
      }
    }
    for (const key of Object.keys(data)) {
      if ((PROFILE_KEYS as readonly string[]).includes(key) || key === "system_prompt_id") continue;
      warnings.push(`agents:${name}: vibe config override "${key}" has no portable equivalent; dropped`);
    }
    if (!body && !description) {
      warnings.push(`agents:${name}: profile has neither a description nor a custom system prompt; not migrated`);
      continue;
    }
    if (body && !body.endsWith("\n")) body += "\n";
    const content = description
      ? `---\ndescription: ${JSON.stringify(description)}\n---\n${body}`
      : body;
    agents.push({ name, content });
  }
  return agents;
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

/**
 * Plan vibe agent profile writes: one TOML profile per agent plus, when the
 * agent has a body, a prompt markdown file wired up via `system_prompt_id`
 * (vibe requires bare prompt filenames, so nested names are flattened).
 */
export function planVibeAgents(
  agents: AgentDef[],
  agentsRel: string,
  promptsRel: string,
  warnings: string[],
): FilePlan[] {
  const plans: FilePlan[] = [];
  const used = new Set<string>();
  for (const a of agents) {
    let name = a.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(
        `agents:${a.name}: vibe agent and prompt names must be bare filenames; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`agents:${a.name}: name collides with another agent after flattening; skipped`);
      continue;
    }
    used.add(name);
    if (BUILTIN_AGENTS.includes(name)) {
      warnings.push(`agents:${name}: a custom profile with this name overrides vibe's builtin "${name}" agent`);
    }
    let description: string | undefined;
    let body = a.content;
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(a.content);
    if (m) {
      const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
      const parsed = lines.map((l) => parseFrontmatterDescription(l));
      if (parsed.every((p) => p !== undefined)) {
        description = parsed.find((p) => p !== undefined);
        body = a.content.slice(m[0].length);
      } else {
        warnings.push(
          `agents:${a.name}: frontmatter has fields beyond description, which vibe agent profiles cannot express; kept verbatim inside the prompt file`,
        );
      }
    }
    const profile: Record<string, unknown> = {};
    profile.description = description ?? `Imported by agentmove from agent ${a.name}`;
    if (body.trim()) {
      if (!body.endsWith("\n")) body += "\n";
      profile.system_prompt_id = name;
      plans.push({ path: `${promptsRel}/${name}.md`, content: body });
    }
    plans.push({ path: `${agentsRel}/${name}.toml`, content: stringifyToml(profile) + "\n" });
  }
  return plans;
}

const CLIENT_KEYS = [
  "api_key_env",
  "api_key_header",
  "api_key_format",
  "startup_timeout_sec",
  "tool_timeout_sec",
  "enabled_tools",
  "disabled_tools",
] as const;

export async function readVibeConfig(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseToml);
  return isRecord(data) ? data : {};
}

export function parseVibeServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const list = Array.isArray(config.mcp_servers) ? config.mcp_servers : [];
  const servers: McpServer[] = [];
  for (const rawEntry of list) {
    if (!isRecord(rawEntry) || typeof rawEntry.name !== "string") {
      warnings.push("mcp: vibe entry without a name; dropped");
      continue;
    }
    const name = rawEntry.name;
    const url = typeof rawEntry.url === "string" ? rawEntry.url : undefined;
    const command = typeof rawEntry.command === "string" ? rawEntry.command : undefined;
    if (!url && !command) {
      warnings.push(`mcp:${name}: neither command nor url; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (rawEntry[key] !== undefined) {
        warnings.push(`mcp:${name}: vibe ${key} setting is client-specific; not migrated`);
      }
    }
    servers.push({
      name,
      transport: url ? "http" : "stdio",
      command,
      args: stringArgs(rawEntry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(rawEntry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(rawEntry.headers, `mcp:${name}.headers`, warnings),
    });
  }
  return servers;
}

export function renderVibeServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = { name: s.name };
    if (s.transport === "stdio") {
      entry.transport = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: vibe does not document cwd; dropped`);
    } else {
      if (s.transport === "sse") {
        warnings.push(`mcp:${s.name}: vibe has no sse transport; emitted as http`);
      }
      entry.transport = "http";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: vibe has no per-server disabled flag; server emitted as enabled`);
    }
    out.push(entry);
  }
  return out;
}

/** Merge imported entries into the existing name-keyed array of tables. */
export function mergeVibeServers(
  existing: unknown,
  imported: Record<string, unknown>[],
  warnings: string[],
  replace: boolean,
): Record<string, unknown>[] {
  const existingList = (Array.isArray(existing) ? existing : []).filter(isRecord);
  if (replace) {
    const importedNames = new Set(imported.map((e) => e.name));
    for (const e of existingList) {
      if (typeof e.name === "string" && !importedNames.has(e.name)) {
        warnings.push(`mcp:${e.name}: removed by --replace-mcp`);
      }
    }
    return imported;
  }
  const out = [...existingList];
  for (const entry of imported) {
    const idx = out.findIndex((e) => e.name === entry.name);
    if (idx >= 0) {
      if (JSON.stringify(out[idx]) !== JSON.stringify(entry)) {
        warnings.push(`mcp:${String(entry.name)}: existing server with the same name overwritten by import`);
      }
      out[idx] = entry;
    } else {
      out.push(entry);
    }
  }
  return out;
}

export async function planVibeMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readVibeConfig(file);
  config.mcp_servers = mergeVibeServers(
    config.mcp_servers,
    renderVibeServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: stringifyToml(config) + "\n" });
  }
  return files;
}

export const vibe: ClientAdapter = {
  id: "vibe",
  label: "Vibe Code CLI",
  defaultPath: "~/.vibe (config.toml + AGENTS.md + skills/ + agents/ + prompts/)",
  supportsAgents: true,

  async detect(home) {
    return isDir(path.join(home, ".vibe"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "vibe";

    const config = await readVibeConfig(path.join(home, CONFIG_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseVibeServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.agents = await readVibeAgents(
      path.join(home, AGENTS_DIR_REL),
      path.join(home, PROMPTS_REL),
      warnings,
    );
    if (bundle.agents.length) warnings.push(VIBE_AGENTS_EXPORT_WARNING);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planVibeMcp(
        bundle,
        path.join(home, CONFIG_REL),
        CONFIG_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        "persona: vibe has no persona file; appended to ~/.vibe/AGENTS.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: AGENTS_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: vibe has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.agents.length) {
      files.push(...planVibeAgents(bundle.agents, AGENTS_DIR_REL, PROMPTS_REL, warnings));
      warnings.push(VIBE_AGENTS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};
