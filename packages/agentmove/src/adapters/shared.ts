import path from "node:path";
import {
  AgentDef,
  asStringRecord,
  CommandDef,
  isRecord,
  McpServer,
  Skill,
  stringArgs,
  Transport,
} from "../model.js";
import { isDir, listDir, readText, readTextTree } from "../fsutil.js";

/** Parse a `mcpServers`-style map entry (Claude Code / Cursor / Gemini shape). */
export function parseCommonMcpEntry(
  name: string,
  entry: unknown,
  warnings: string[],
): McpServer | undefined {
  if (!isRecord(entry)) {
    warnings.push(`mcp:${name}: entry is not an object; dropped`);
    return undefined;
  }
  const url =
    typeof entry.url === "string"
      ? entry.url
      : typeof entry.httpUrl === "string" // Gemini CLI / Qwen Code streamable-HTTP spelling
        ? entry.httpUrl
        : undefined;
  const command = typeof entry.command === "string" ? entry.command : undefined;
  let transport: Transport;
  if (typeof entry.type === "string" && ["stdio", "http", "sse"].includes(entry.type)) {
    transport = entry.type as Transport;
  } else if (url) {
    transport = "http";
  } else {
    transport = "stdio";
  }
  if (transport === "stdio" && !command) {
    warnings.push(`mcp:${name}: stdio server without a command; dropped`);
    return undefined;
  }
  if (transport !== "stdio" && !url) {
    warnings.push(`mcp:${name}: remote server without a url; dropped`);
    return undefined;
  }
  return {
    name,
    transport,
    command,
    args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
    env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
    cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
    url,
    headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
  };
}

/** Render an entry in the common `mcpServers` shape. */
export function renderCommonMcpEntry(s: McpServer, withType: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (withType) out.type = s.transport;
  if (s.transport === "stdio") {
    out.command = s.command;
    if (s.args?.length) out.args = s.args;
    if (s.env && Object.keys(s.env).length) out.env = s.env;
    if (s.cwd) out.cwd = s.cwd;
  } else {
    out.url = s.url;
    if (s.headers && Object.keys(s.headers).length) out.headers = s.headers;
  }
  return out;
}

/**
 * Merge imported server entries into the target's existing map (official
 * `mcp add` semantics: never remove servers the target already has).
 * Same-name conflicts are won by the imported entry, with a warning.
 * With `replace`, the imported map replaces the existing one entirely.
 */
export function mergeMcpRecords(
  existing: Record<string, unknown>,
  imported: Record<string, unknown>,
  warnings: string[],
  replace: boolean,
): Record<string, unknown> {
  if (replace) {
    for (const name of Object.keys(existing)) {
      if (!(name in imported)) warnings.push(`mcp:${name}: removed by --replace-mcp`);
    }
    return imported;
  }
  const out: Record<string, unknown> = { ...existing };
  for (const [name, entry] of Object.entries(imported)) {
    if (name in existing && JSON.stringify(existing[name]) !== JSON.stringify(entry)) {
      warnings.push(`mcp:${name}: existing server with the same name overwritten by import`);
    }
    out[name] = entry;
  }
  return out;
}

/** Read every skill directory (containing SKILL.md or any files) under a root. */
export async function readSkillsDir(root: string, warnings: string[]): Promise<Skill[]> {
  const skills: Skill[] = [];
  if (!(await isDir(root))) return skills;
  for (const name of await listDir(root)) {
    const dir = path.join(root, name);
    if (!(await isDir(dir))) continue;
    const files = await readTextTree(dir, warnings);
    if (Object.keys(files).length) skills.push({ name, files });
  }
  return skills;
}

/** Plan writes for skills into a target skills root (relative to home). */
export function planSkills(skills: Skill[], rootRel: string): { path: string; content: string }[] {
  const plans: { path: string; content: string }[] = [];
  for (const skill of skills) {
    for (const [rel, content] of Object.entries(skill.files)) {
      plans.push({ path: `${rootRel}/${skill.name}/${rel}`, content });
    }
  }
  return plans;
}

/** Read custom agent definitions (`<name><ext>` markdown files) under a root. */
export async function readAgentsDir(root: string, ext: string): Promise<AgentDef[]> {
  const agents: AgentDef[] = [];
  if (!(await isDir(root))) return agents;
  for (const name of (await listDir(root)).sort()) {
    if (!name.endsWith(ext) || name === ext) continue;
    const content = await readText(path.join(root, name));
    if (content !== undefined) agents.push({ name: name.slice(0, -ext.length), content });
  }
  return agents;
}

/**
 * Read custom agents from a directory recursively (for clients that scan
 * subdirectories, e.g. Kimi Code CLI). Subdirectory paths become part of the
 * agent name (`sub/helper`), so the relative layout round-trips. Hidden
 * directories are skipped.
 */
export async function readAgentsDirRecursive(root: string, ext: string): Promise<AgentDef[]> {
  const agents: AgentDef[] = [];
  if (!(await isDir(root))) return agents;
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const name of (await listDir(dir)).sort()) {
      const full = path.join(dir, name);
      if (await isDir(full)) {
        if (!name.startsWith(".")) await walk(full, `${prefix}${name}/`);
        continue;
      }
      if (!name.endsWith(ext) || name === ext) continue;
      const content = await readText(full);
      if (content !== undefined) {
        agents.push({ name: `${prefix}${name.slice(0, -ext.length)}`, content });
      }
    }
  };
  await walk(root, "");
  return agents;
}

/** Merge agent lists by name; later lists win on conflicts. */
export function mergeAgentLists(...lists: AgentDef[][]): AgentDef[] {
  const byName = new Map<string, AgentDef>();
  for (const list of lists) for (const a of list) byName.set(a.name, a);
  return [...byName.values()].sort((x, y) => x.name.localeCompare(y.name));
}

/** Plan writes for custom agents into a target agents root (relative to home). */
export function planAgents(
  agents: AgentDef[],
  rootRel: string,
  ext: string,
): { path: string; content: string }[] {
  return agents.map((a) => ({ path: `${rootRel}/${a.name}${ext}`, content: a.content }));
}

/**
 * Plan writes for commands into a flat-scan commands root: clients that only
 * discover top-level files get nested names (`git/commit`) flattened to
 * `git-commit`, with a warning; a resulting name collision skips the command.
 */
export function planCommandsFlat(
  commands: CommandDef[],
  rootRel: string,
  clientId: string,
  warnings: string[],
): { path: string; content: string }[] {
  const plans: { path: string; content: string }[] = [];
  const used = new Set<string>();
  for (const c of commands) {
    let name = c.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(
        `commands:${c.name}: ${clientId} only discovers top-level command files; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`commands:${c.name}: name collides with another command after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({ path: `${rootRel}/${name}.md`, content: c.content });
  }
  return plans;
}

export function mergeSkills(existing: Skill[], incoming: Skill[]): Skill[] {
  const byName = new Map(existing.map((s) => [s.name, s]));
  for (const s of incoming) byName.set(s.name, s);
  return [...byName.values()];
}

export const AGENTMOVE_SECTION = "## Imported by agentmove";

/** Merge persona/memory into an instructions markdown when the client has no native slot. */
export function appendSections(
  base: string | undefined,
  sections: { title: string; body: string }[],
): string {
  let out = (base ?? "").trimEnd();
  for (const s of sections) {
    out += `\n\n${AGENTMOVE_SECTION}: ${s.title}\n\n${s.body.trim()}\n`;
  }
  return out.trimStart() === "" ? "" : out.replace(/^\n+/, "") + "\n";
}

/**
 * Whether the target's MCP/config file needs rewriting at all: skip the plan
 * when the import brings no servers, no explicit --replace-mcp, and no other
 * config change, so a memory/instructions-only import leaves it untouched.
 */
export function touchesMcpConfig(
  serverCount: number,
  replaceMcp: boolean,
  otherChanges = false,
): boolean {
  return serverCount > 0 || replaceMcp || otherChanges;
}
