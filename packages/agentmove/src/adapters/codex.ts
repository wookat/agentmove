import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  AgentDef,
  asStringRecord,
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
  stringArgs,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import {
  appendSections,
  mergeMcpRecords,
  planCommandsFlat,
  planSkills,
  readAgentsDir,
  readSkillsDir,
  touchesMcpConfig,
} from "./shared.js";

export interface CodexStyleLayout {
  id: ClientId;
  label: string;
  defaultPath: string;
  /** Directory holding config.toml/AGENTS.md, relative to home. */
  configDir: string;
  /** Agent Skills root relative to home, or undefined when unsupported. */
  skillsRel?: string;
  /** Custom prompts root relative to home, or undefined when unsupported. */
  promptsRel?: string;
  /** Custom agents (agent role TOML files) root relative to home, or undefined when unsupported. */
  agentsRel?: string;
}

const AGENT_PORTABLE_FIELDS = ["name", "description", "developer_instructions"];

export const CODEX_AGENTS_EXPORT_WARNING =
  "agents: converted from codex agent role TOML (name + description + developer_instructions); codex-specific settings are dropped with per-field warnings";

export const CODEX_AGENTS_IMPORT_WARNING =
  "agents: written as codex agent role TOML (name + description + developer_instructions only); review model/sandbox/MCP overrides in the target agent after import";

/** Convert one codex agent role TOML file into a portable markdown agent. */
export function codexAgentFromToml(
  raw: string,
  file: string,
  warnings: string[],
): AgentDef | undefined {
  let data: unknown;
  try {
    data = parseToml(raw);
  } catch {
    warnings.push(`agents:${file}: invalid TOML; not migrated`);
    return undefined;
  }
  if (!isRecord(data)) {
    warnings.push(`agents:${file}: not a TOML table; not migrated`);
    return undefined;
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    warnings.push(`agents:${file}: agent role file must define a non-empty "name"; not migrated`);
    return undefined;
  }
  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (!description) {
    warnings.push(`agents:${file}: agent role "${name}" has no description (codex rejects it); not migrated`);
    return undefined;
  }
  const instructions =
    typeof data.developer_instructions === "string" ? data.developer_instructions : "";
  if (!instructions.trim()) {
    warnings.push(
      `agents:${file}: agent role "${name}" has no developer_instructions (codex rejects it); not migrated`,
    );
    return undefined;
  }
  for (const key of Object.keys(data)) {
    if (!AGENT_PORTABLE_FIELDS.includes(key)) {
      warnings.push(`agents:${name}: codex agent setting "${key}" has no portable equivalent; dropped`);
    }
  }
  let body = instructions;
  if (!body.endsWith("\n")) body += "\n";
  const content = `---\ndescription: ${JSON.stringify(description)}\n---\n${body}`;
  return { name, content };
}

/** Read every agent role TOML file under an agents root (recursive, like codex's loader). */
export async function readCodexAgents(root: string, warnings: string[]): Promise<AgentDef[]> {
  const files: string[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    if (!(await isDir(dir))) return;
    for (const name of (await listDir(dir)).sort()) {
      const full = path.join(dir, name);
      if (await isDir(full)) {
        await walk(full, `${prefix}${name}/`);
      } else if (name.endsWith(".toml")) {
        files.push(`${prefix}${name}`);
      }
    }
  };
  await walk(root, "");
  files.sort();
  const agents: AgentDef[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const raw = await readText(path.join(root, file));
    if (raw === undefined) continue;
    const agent = codexAgentFromToml(raw, file, warnings);
    if (!agent) continue;
    if (seen.has(agent.name)) {
      warnings.push(
        `agents:${file}: duplicate agent role name "${agent.name}"; codex keeps the first file found, so this one was not exported`,
      );
      continue;
    }
    seen.add(agent.name);
    agents.push(agent);
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

/** Convert a portable markdown agent into codex agent role TOML content. */
export function codexAgentToToml(a: AgentDef, name: string, warnings: string[]): string {
  let description: string | undefined;
  let instructions = a.content;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(a.content);
  if (m) {
    const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
    const parsed = lines.map((l) => parseFrontmatterDescription(l));
    if (parsed.every((p) => p !== undefined)) {
      description = parsed.find((p) => p !== undefined);
      instructions = a.content.slice(m[0].length);
    } else {
      warnings.push(
        `agents:${a.name}: frontmatter has fields beyond description, which codex agent role TOML cannot express; kept verbatim inside developer_instructions`,
      );
    }
  }
  return (
    stringifyToml({
      name,
      description: description ?? `Imported by agentmove from agent ${a.name}`,
      developer_instructions: instructions,
    }) + "\n"
  );
}

/** Plan codex agent role TOML writes into an agents root (nested names flattened). */
export function planCodexAgents(
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
        `agents:${a.name}: codex derives the role name from the file's "name" field, not its path; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`agents:${a.name}: name collides with another agent after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({ path: `${rootRel}/${name}.toml`, content: codexAgentToToml(a, name, warnings) });
  }
  return plans;
}

/**
 * OpenAI Codex stores config.toml + AGENTS.md in a config directory
 * (~/.codex for the standalone CLI, its own root under ~/Library for
 * Xcode's bundled Codex agent).
 */
export function makeCodexStyleAdapter(layout: CodexStyleLayout): ClientAdapter {
  const { id, configDir, skillsRel, promptsRel, agentsRel } = layout;
  const CONFIG_REL = `${configDir}/config.toml`;
  const AGENTS_REL = `${configDir}/AGENTS.md`;
  const agentsTilde = `~/${AGENTS_REL}`;

  const CLIENT_SPECIFIC_KEYS = [
    "env_vars",
    "startup_timeout_sec",
    "tool_timeout_sec",
    "enabled_tools",
    "disabled_tools",
    "default_tools_approval_mode",
    "tools",
    "auth",
    "experimental_environment",
  ] as const;

  async function readConfig(home: string): Promise<Record<string, unknown>> {
    const file = path.join(home, CONFIG_REL);
    const raw = await readText(file);
    if (raw === undefined) return {};
    const data = parseFile<unknown>(file, raw, parseToml);
    return isRecord(data) ? data : {};
  }

  return {
    id,
    label: layout.label,
    defaultPath: layout.defaultPath,
    supportsAgents: agentsRel !== undefined,
    supportsCommands: promptsRel !== undefined,

    async detect(home) {
      return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, configDir)));
    },

    async exportBundle(home): Promise<ExportResult> {
      const warnings: string[] = [];
      const bundle: Bundle = emptyBundle();
      bundle.manifest.exportedFrom = id;

      const config = await readConfig(home);
      if (typeof config.model === "string") bundle.config.model = config.model;
      bundle.config.raw = config;

      const serversObj = isRecord(config.mcp_servers) ? config.mcp_servers : {};
      const servers: McpServer[] = [];
      for (const [name, entry] of Object.entries(serversObj)) {
        if (!isRecord(entry)) {
          warnings.push(`mcp:${name}: entry is not a table; dropped`);
          continue;
        }
        const url = typeof entry.url === "string" ? entry.url : undefined;
        const command = typeof entry.command === "string" ? entry.command : undefined;
        if (!url && !command) {
          warnings.push(`mcp:${name}: neither command nor url; dropped`);
          continue;
        }
        const headers: Record<string, string> = {
          ...(asStringRecord(entry.http_headers, `mcp:${name}.http_headers`, warnings) ?? {}),
        };
        const envHeaders = asStringRecord(
          entry.env_http_headers,
          `mcp:${name}.env_http_headers`,
          warnings,
        );
        for (const [header, envVar] of Object.entries(envHeaders ?? {})) {
          headers[header] = `\${${envVar}}`;
          warnings.push(
            `mcp:${name}: env_http_headers.${header} exported as a \${${envVar}} placeholder header`,
          );
        }
        if (typeof entry.bearer_token_env_var === "string") {
          headers.Authorization = `Bearer \${${entry.bearer_token_env_var}}`;
          warnings.push(
            `mcp:${name}: bearer_token_env_var exported as an Authorization: Bearer \${${entry.bearer_token_env_var}} placeholder header`,
          );
        }
        const clientSpecific = CLIENT_SPECIFIC_KEYS.filter((k) => entry[k] !== undefined);
        if (clientSpecific.length) {
          warnings.push(
            `mcp:${name}: ${id}-specific field(s) ${clientSpecific.join(", ")} have no portable equivalent; not exported (kept on merge)`,
          );
        }
        servers.push({
          name,
          transport: url ? "http" : "stdio",
          command,
          args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
          env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
          cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
          url,
          headers: Object.keys(headers).length ? headers : undefined,
          enabled: typeof entry.enabled === "boolean" ? entry.enabled : undefined,
        });
      }
      bundle.mcpServers = servers;

      bundle.instructions =
        (await readText(path.join(home, `${configDir}/AGENTS.override.md`))) ??
        (await readText(path.join(home, AGENTS_REL)));
      if (skillsRel) {
        bundle.skills = await readSkillsDir(path.join(home, skillsRel), warnings);
      }
      if (promptsRel) {
        bundle.commands = await readAgentsDir(path.join(home, promptsRel), ".md");
      }
      if (agentsRel) {
        bundle.agents = await readCodexAgents(path.join(home, agentsRel), warnings);
        if (bundle.agents.length) warnings.push(CODEX_AGENTS_EXPORT_WARNING);
      }
      warnings.push(`${id} memories are managed by the client and not exported in v0`);
      return { bundle, warnings };
    },

    async planImport(bundle, home, opts): Promise<ImportResult> {
      const warnings: string[] = [];
      const files: FilePlan[] = [];

      const config = await readConfig(home);
      const mcp_servers: Record<string, unknown> = {};
      for (const s of bundle.mcpServers) {
        const entry: Record<string, unknown> = {};
        if (s.transport === "stdio") {
          entry.command = s.command;
          if (s.args?.length) entry.args = s.args;
          if (s.env && Object.keys(s.env).length) entry.env = s.env;
          if (s.cwd) entry.cwd = s.cwd;
        } else {
          if (s.transport === "sse") {
            warnings.push(`mcp:${s.name}: ${id} uses streamable HTTP for remote servers; sse emitted as url`);
          }
          entry.url = s.url;
          const httpHeaders: Record<string, string> = {};
          const envHttpHeaders: Record<string, string> = {};
          let bearerEnvVar: string | undefined;
          for (const [header, value] of Object.entries(s.headers ?? {})) {
            const bearer =
              header.toLowerCase() === "authorization"
                ? /^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value)
                : null;
            const placeholder = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
            if (bearer) {
              bearerEnvVar = bearer[1];
              warnings.push(
                `mcp:${s.name}: Authorization Bearer placeholder written as bearer_token_env_var = "${bearer[1]}"`,
              );
            } else if (placeholder) {
              envHttpHeaders[header] = placeholder[1]!;
              warnings.push(
                `mcp:${s.name}: ${header} placeholder written as env_http_headers.${header} = "${placeholder[1]}"`,
              );
            } else {
              httpHeaders[header] = value;
            }
          }
          if (Object.keys(httpHeaders).length) entry.http_headers = httpHeaders;
          if (Object.keys(envHttpHeaders).length) entry.env_http_headers = envHttpHeaders;
          if (bearerEnvVar) entry.bearer_token_env_var = bearerEnvVar;
        }
        if (s.enabled === false) entry.enabled = false;
        mcp_servers[s.name] = entry;
      }
      const existing = isRecord(config.mcp_servers) ? config.mcp_servers : {};
      config.mcp_servers = mergeMcpRecords(existing, mcp_servers, warnings, opts?.replaceMcp ?? false);
      if (bundle.config.model) config.model = bundle.config.model;
      if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false, bundle.config.model !== undefined)) {
        files.push({ path: CONFIG_REL, content: stringifyToml(config) + "\n" });
      }

      const sections: { title: string; body: string }[] = [];
      if (bundle.persona) {
        sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
        warnings.push(`persona: ${id} has no persona file; appended to ${agentsTilde} (approximated)`);
      }
      if (bundle.memory.length) {
        sections.push({
          title: "memory",
          body: bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, "\n  ")}`).join("\n"),
        });
        warnings.push(`memory: ${id} memories cannot be written directly; appended to ${agentsTilde} (approximated)`);
      }
      const instructions = appendSections(bundle.instructions, sections);
      if (instructions) files.push({ path: AGENTS_REL, content: instructions });

      if (skillsRel) {
        files.push(...planSkills(bundle.skills, skillsRel));
      } else if (bundle.skills.length) {
        warnings.push(`skills: ${id} has no documented skills directory; skipped`);
      }
      if (agentsRel && bundle.agents.length) {
        files.push(...planCodexAgents(bundle.agents, agentsRel, warnings));
        warnings.push(CODEX_AGENTS_IMPORT_WARNING);
      } else if (bundle.agents.length) {
        warnings.push(`agents: ${id} has no documented custom agents directory; skipped`);
      }
      if (promptsRel && bundle.commands.length) {
        files.push(...planCommandsFlat(bundle.commands, promptsRel, id, warnings));
        warnings.push(
          `commands: written to ~/${promptsRel} (invoked as /prompts:<name>); ` +
            `${id} custom prompts are deprecated in favor of skills but still supported`,
        );
      }
      return { files, warnings };
    },
  };
}

export const codex: ClientAdapter = makeCodexStyleAdapter({
  id: "codex",
  label: "OpenAI Codex CLI",
  defaultPath: "~/.codex (skills: ~/.agents/skills, prompts: ~/.codex/prompts, agents: ~/.codex/agents)",
  configDir: ".codex",
  skillsRel: ".agents/skills",
  promptsRel: ".codex/prompts",
  agentsRel: ".codex/agents",
});
