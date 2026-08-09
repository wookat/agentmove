import path from "node:path";
import { parse as parseYaml } from "yaml";
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
  Transport,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planAgents, readAgentsDir, touchesMcpConfig } from "./shared.js";

/**
 * Nanocoder (Nano Collective). Global MCP servers live under the `mcpServers`
 * key of ~/.config/nanocoder/.mcp.json; each entry carries an explicit
 * `transport` ("stdio", "http", or "websocket"), stdio uses command/args/env,
 * http uses url/headers, and the typed schema includes an `enabled` boolean.
 * Instructions (AGENTS.md) load from the project root only, and nanocoder
 * skills use their own skill.yaml bundle format rather than the Agent Skills
 * standard, so both stay project-/client-specific at user scope.
 *
 * Custom slash commands are markdown files under ~/.config/nanocoder/commands/
 * (personal) and .nanocoder/commands/ (project, which wins on name conflicts);
 * subdirectories become `:`-separated namespaces, so nested layouts are
 * preserved. A directory containing <dirname>.md is a directory-as-command
 * bundle whose optional resources/ files are client-specific.
 *
 * Custom subagents are flat markdown files under ~/.config/nanocoder/agents/
 * (personal) and .nanocoder/agents/ (project). Nanocoder refuses to load an
 * agent whose frontmatter lacks a non-empty `name` and `description`, so
 * imports inject those keys when missing; everything else is copied as-is.
 */
const MCP_REL = ".config/nanocoder/.mcp.json";
const COMMANDS_DIR_REL = ".config/nanocoder/commands";
const AGENTS_DIR_REL = ".config/nanocoder/agents";
const SKILLS_DIR_REL = ".config/nanocoder/skills";

export const NANOCODER_COMMANDS_WARNING =
  "commands: frontmatter fields (description/aliases/triggers/tags) and {{parameter}} placeholders are client-specific and copied as-is; review after import";

export const NANOCODER_AGENTS_WARNING =
  "agents: frontmatter fields (provider/model/contextWindow/tools/disallowedTools/subscribe) are client-specific and copied as-is; review after import";

function frontmatterLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

/**
 * Nanocoder only loads agents whose frontmatter has a non-empty `name` and
 * `description`; inject the missing keys (with warnings) so imported agents
 * actually appear in the client.
 */
export function ensureNanocoderAgentFrontmatter(
  name: string,
  content: string,
  warnings: string[],
): string {
  const nameLine = frontmatterLine("name", name);
  const descLine = frontmatterLine("description", `Imported by agentmove from agent ${name}`);
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) {
    warnings.push(
      `agents:${name}: nanocoder requires name/description frontmatter; a frontmatter block was added`,
    );
    return `---\n${nameLine}\n${descLine}\n---\n${content}`;
  }
  const block = m[1] ?? "";
  const hasKey = (key: string): boolean =>
    block.split(/\r?\n/).some((line) => new RegExp(`^${key}:\\s*\\S`).test(line));
  const additions: string[] = [];
  if (!hasKey("name")) {
    additions.push(nameLine);
    warnings.push(`agents:${name}: nanocoder requires a name frontmatter field; added`);
  }
  if (!hasKey("description")) {
    additions.push(descLine);
    warnings.push(`agents:${name}: nanocoder requires a description frontmatter field; added`);
  }
  if (!additions.length) return content;
  return `---\n${additions.join("\n")}\n${block}\n---\n${content.slice(m[0].length)}`;
}

/**
 * Plan writes into a flat nanocoder agents root: nested names are flattened
 * with a warning (collisions skipped) and required frontmatter is injected.
 */
export function planNanocoderAgents(
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
        `agents:${a.name}: nanocoder only discovers top-level agent files; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`agents:${a.name}: name collides with another agent after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({
      path: `${rootRel}/${name}.md`,
      content: ensureNanocoderAgentFrontmatter(name, a.content, warnings),
    });
  }
  return plans;
}

/**
 * Read a nanocoder commands tree. Subdirectories are namespaces unless they
 * contain <dirname>.md, in which case the directory is a single command whose
 * markdown is exported (resources/ files are not portable and warned).
 */
export async function readNanocoderCommandsDir(
  root: string,
  warnings: string[],
  prefix = "",
): Promise<AgentDef[]> {
  if (!(await isDir(root))) return [];
  const out: AgentDef[] = [];
  for (const entry of (await listDir(root)).sort()) {
    if (entry.startsWith(".")) continue;
    const full = path.join(root, entry);
    if (await isDir(full)) {
      const bundleFile = path.join(full, `${entry}.md`);
      if (await exists(bundleFile)) {
        const content = await readText(bundleFile);
        if (content !== undefined) {
          out.push({ name: `${prefix}${entry}`, content });
        }
        if (await isDir(path.join(full, "resources"))) {
          warnings.push(
            `commands:${prefix}${entry}: nanocoder resources/ files are client-specific; only the command markdown is migrated`,
          );
        }
      } else {
        out.push(...(await readNanocoderCommandsDir(full, warnings, `${prefix}${entry}/`)));
      }
    } else if (entry.endsWith(".md")) {
      const content = await readText(full);
      if (content !== undefined) {
        out.push({ name: `${prefix}${entry.slice(0, -3)}`, content });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const SKILL_NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const SKILL_CLIENT_KEYS = ["version", "author", "tags", "subscribe", "tools_visibility"] as const;

/**
 * Read skill bundles (`<root>/<dir>/skill.yaml` + optional commands/ and
 * agents/ subdirs) and fan their portable members into the commands/agents
 * arrays. Bundle commands map to nested names (`<bundle>/<file>`, or bare
 * `<bundle>` when the file is named after the bundle) mirroring nanocoder's
 * `/<bundle>:<file>` invocation; the single subagent keeps its file basename.
 * Bundle tools are nanocoder shell tools and are not migrated. Names already
 * taken by the flat directories win.
 */
export async function readNanocoderSkillBundles(
  root: string,
  commands: AgentDef[],
  agents: AgentDef[],
  warnings: string[],
): Promise<void> {
  if (!(await isDir(root))) return;
  const commandNames = new Set(commands.map((c) => c.name));
  const agentNames = new Set(agents.map((a) => a.name));
  for (const entry of (await listDir(root)).sort()) {
    if (entry.startsWith(".")) continue;
    const bundleDir = path.join(root, entry);
    if (!(await isDir(bundleDir))) continue;
    const manifestRaw = await readText(path.join(bundleDir, "skill.yaml"));
    if (manifestRaw === undefined) continue;
    let manifest: unknown;
    try {
      manifest = parseYaml(manifestRaw);
    } catch {
      warnings.push(`skills:${entry}: skill.yaml is not valid YAML; bundle skipped`);
      continue;
    }
    if (!isRecord(manifest)) {
      warnings.push(`skills:${entry}: skill.yaml is not a YAML mapping; bundle skipped`);
      continue;
    }
    const name = manifest.name;
    if (typeof name !== "string" || !SKILL_NAME_REGEX.test(name)) {
      warnings.push(`skills:${entry}: skill.yaml has an invalid or missing name; bundle skipped`);
      continue;
    }
    if (typeof manifest.description !== "string" || !manifest.description.trim()) {
      warnings.push(`skills:${entry}: skill.yaml has a missing or empty description; bundle skipped`);
      continue;
    }
    const clientKeys = SKILL_CLIENT_KEYS.filter((k) => manifest[k] !== undefined);
    if (clientKeys.length) {
      warnings.push(
        `skills:${name}: skill.yaml ${clientKeys.join("/")} settings are nanocoder-specific; not migrated`,
      );
    }
    const commandsDir = path.join(bundleDir, "commands");
    if (await isDir(commandsDir)) {
      for (const file of (await listDir(commandsDir)).sort()) {
        if (!file.endsWith(".md")) continue;
        const content = await readText(path.join(commandsDir, file));
        if (content === undefined) continue;
        const base = file.slice(0, -3);
        const cmdName = base === name ? name : `${name}/${base}`;
        if (commandNames.has(cmdName)) {
          warnings.push(
            `commands:${cmdName}: bundle ${name} command collides with an existing command; skipped`,
          );
          continue;
        }
        commandNames.add(cmdName);
        commands.push({ name: cmdName, content });
      }
    }
    const agentsDir = path.join(bundleDir, "agents");
    if (await isDir(agentsDir)) {
      const mdFiles = (await listDir(agentsDir)).filter((f) => f.endsWith(".md")).sort();
      if (mdFiles.length > 1) {
        warnings.push(
          `skills:${name}: nanocoder loads only one subagent per bundle; ignoring ${mdFiles
            .slice(1)
            .join(", ")}`,
        );
      }
      const first = mdFiles[0];
      if (first !== undefined) {
        const content = await readText(path.join(agentsDir, first));
        if (content !== undefined) {
          const agentName = first.slice(0, -3);
          if (agentNames.has(agentName)) {
            warnings.push(
              `agents:${agentName}: bundle ${name} subagent collides with an existing agent; skipped`,
            );
          } else {
            agentNames.add(agentName);
            agents.push({ name: agentName, content });
            warnings.push(
              `agents:${agentName}: extracted from skill bundle ${name}; bundle scoping and sibling tools are not migrated`,
            );
          }
        }
      }
    }
    if (await isDir(path.join(bundleDir, "tools"))) {
      warnings.push(
        `skills:${name}: bundle tools/ are nanocoder shell tools (client-specific); not migrated`,
      );
    }
  }
  commands.sort((a, b) => a.name.localeCompare(b.name));
  agents.sort((a, b) => a.name.localeCompare(b.name));
}

const CLIENT_KEYS = ["timeout", "alwaysAllow", "description", "tags"] as const;

export async function readNanocoderMcp(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseNanocoderServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (!isRecord(entry)) {
      warnings.push(`mcp:${name}: entry is not an object; dropped`);
      continue;
    }
    if (entry.transport === "websocket") {
      warnings.push(`mcp:${name}: nanocoder websocket transport has no portable equivalent; skipped`);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const command = typeof entry.command === "string" ? entry.command : undefined;
    let transport: Transport;
    if (entry.transport === "stdio" || entry.transport === "http") {
      transport = entry.transport;
    } else if (url) {
      transport = "http";
    } else {
      transport = "stdio";
    }
    if (transport === "stdio" && !command) {
      warnings.push(`mcp:${name}: stdio server without a command; dropped`);
      continue;
    }
    if (transport === "http" && !url) {
      warnings.push(`mcp:${name}: remote server without a url; dropped`);
      continue;
    }
    for (const key of CLIENT_KEYS) {
      if (entry[key] !== undefined) {
        warnings.push(`mcp:${name}: nanocoder ${key} setting is client-specific; not migrated`);
      }
    }
    servers.push({
      name,
      transport,
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      url,
      headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
      enabled: entry.enabled === false ? false : undefined,
    });
  }
  return servers;
}

export function renderNanocoderServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      entry.transport = "stdio";
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) warnings.push(`mcp:${s.name}: nanocoder does not support cwd; dropped`);
    } else {
      if (s.transport === "sse") {
        warnings.push(`mcp:${s.name}: nanocoder has no sse transport; emitted as http`);
      }
      entry.transport = "http";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    if (s.enabled === false) entry.enabled = false;
    out[s.name] = entry;
  }
  return out;
}

export async function planNanocoderMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readNanocoderMcp(file);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  config.mcpServers = mergeMcpRecords(
    existing,
    renderNanocoderServers(bundle, warnings),
    warnings,
    replaceMcp,
  );
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const nanocoder: ClientAdapter = {
  id: "nanocoder",
  label: "Nanocoder",
  defaultPath: "~/.config/nanocoder (.mcp.json + commands/ + agents/)",
  supportsAgents: true,
  supportsCommands: true,

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".config/nanocoder")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "nanocoder";

    const config = await readNanocoderMcp(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseNanocoderServers(config, warnings);
    bundle.commands = await readNanocoderCommandsDir(
      path.join(home, COMMANDS_DIR_REL),
      warnings,
    );
    bundle.agents = await readAgentsDir(path.join(home, AGENTS_DIR_REL), ".md");
    await readNanocoderSkillBundles(
      path.join(home, SKILLS_DIR_REL),
      bundle.commands,
      bundle.agents,
      warnings,
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planNanocoderMcp(
        bundle,
        path.join(home, MCP_REL),
        MCP_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    if (bundle.instructions) {
      warnings.push(
        "instructions: nanocoder reads AGENTS.md from the project root only; use --project",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: nanocoder has no persona file; skipped (use --project for AGENTS.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: nanocoder has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push(
        "skills: nanocoder skills use their own skill.yaml bundle format, not the Agent Skills standard; skipped",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_DIR_REL, ".md"));
      warnings.push(NANOCODER_COMMANDS_WARNING);
    }
    if (bundle.agents.length) {
      files.push(...planNanocoderAgents(bundle.agents, AGENTS_DIR_REL, warnings));
      warnings.push(NANOCODER_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};
