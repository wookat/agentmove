import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
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
  Skill,
  stringArgs,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

/**
 * OpenHands. MCP servers live under the `[mcp]` section of
 * ~/.openhands/config.toml as three transport-specific lists:
 * `stdio_servers` ({name, command, args, env}), `shttp_servers` and
 * `sse_servers` (string URL or {url, api_key, timeout}). Personal
 * instructions are user microagents in ~/.openhands/microagents/*.md.
 * Agent Skills load from ~/.agents/skills/ and the legacy
 * ~/.openhands/skills/, with ~/.agents/skills/ winning duplicate names.
 */
const CONFIG_REL = ".openhands/config.toml";
const MICROAGENTS_REL = ".openhands/microagents";
const SKILLS_REL = ".agents/skills";
const LEGACY_SKILLS_REL = ".openhands/skills";

/**
 * Read Agent Skills from the preferred root and the legacy root, merging by
 * skill name with the preferred root winning (openhands USER_SKILLS_DIRS /
 * project search order). `skip` names (e.g. the managed installed/ store
 * under ~/.openhands/skills/) are excluded from the legacy root.
 */
export async function readOpenhandsSkills(
  preferredRoot: string,
  legacyRoot: string,
  warnings: string[],
  skip: string[] = [],
): Promise<Skill[]> {
  const skills = await readSkillsDir(preferredRoot, warnings);
  const names = new Set(skills.map((s) => s.name));
  for (const skill of await readSkillsDir(legacyRoot, warnings)) {
    if (skip.includes(skill.name)) {
      warnings.push(
        `skills:${skill.name}: openhands-managed installed-skills store; not exported`,
      );
      continue;
    }
    if (names.has(skill.name)) {
      warnings.push(
        `skills:${skill.name}: legacy .openhands/skills copy shadowed by .agents/skills; the .agents/skills version is exported`,
      );
      continue;
    }
    names.add(skill.name);
    skills.push(skill);
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

async function readConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, CONFIG_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseToml);
  return isRecord(data) ? data : {};
}

function parseRemoteList(
  list: unknown,
  transport: "http" | "sse",
  label: string,
  warnings: string[],
): McpServer[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) {
    warnings.push(`mcp:${label}: not a list; dropped`);
    return [];
  }
  const servers: McpServer[] = [];
  for (const item of list) {
    let url: string | undefined;
    let apiKey: string | undefined;
    if (typeof item === "string") {
      url = item;
    } else if (isRecord(item) && typeof item.url === "string") {
      url = item.url;
      if (typeof item.api_key === "string") apiKey = item.api_key;
      if (item.timeout !== undefined) {
        warnings.push(`mcp:${url}: openhands timeout has no portable equivalent; dropped`);
      }
    }
    if (!url) {
      warnings.push(`mcp:${label}: entry without a url; dropped`);
      continue;
    }
    let name: string;
    try {
      name = new URL(url).hostname.replace(/\./g, "-");
    } catch {
      warnings.push(`mcp:${label}: invalid url "${url}"; dropped`);
      continue;
    }
    servers.push({
      name,
      transport,
      url,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
  }
  return servers;
}

export async function readMicroagents(dir: string): Promise<string | undefined> {
  if (!(await isDir(dir))) return undefined;
  const parts: string[] = [];
  for (const name of (await listDir(dir)).sort()) {
    if (!name.endsWith(".md")) continue;
    const content = await readText(path.join(dir, name));
    if (content?.trim()) parts.push(`<!-- ${name} -->\n${content.trim()}`);
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const openhands: ClientAdapter = {
  id: "openhands",
  label: "OpenHands",
  defaultPath: "~/.openhands/config.toml ([mcp]) + ~/.openhands/microagents + ~/.agents/skills",

  async detect(home) {
    return (
      (await exists(path.join(home, CONFIG_REL))) ||
      (await isDir(path.join(home, ".openhands")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "openhands";

    const config = await readConfig(home);
    bundle.config.raw = config;
    const mcp = isRecord(config.mcp) ? config.mcp : {};
    const servers: McpServer[] = [];

    if (mcp.stdio_servers !== undefined) {
      if (Array.isArray(mcp.stdio_servers)) {
        for (const item of mcp.stdio_servers) {
          if (!isRecord(item) || typeof item.name !== "string" || typeof item.command !== "string") {
            warnings.push("mcp:stdio_servers: entry without name/command; dropped");
            continue;
          }
          servers.push({
            name: item.name,
            transport: "stdio",
            command: item.command,
            args: stringArgs(item.args, `mcp:${item.name}.args`, warnings),
            env: asStringRecord(item.env, `mcp:${item.name}.env`, warnings),
          });
        }
      } else {
        warnings.push("mcp:stdio_servers: not a list; dropped");
      }
    }
    servers.push(...parseRemoteList(mcp.shttp_servers, "http", "shttp_servers", warnings));
    servers.push(...parseRemoteList(mcp.sse_servers, "sse", "sse_servers", warnings));
    bundle.mcpServers = servers;

    bundle.skills = await readOpenhandsSkills(
      path.join(home, SKILLS_REL),
      path.join(home, LEGACY_SKILLS_REL),
      warnings,
      ["installed"],
    );
    bundle.instructions = await readMicroagents(path.join(home, MICROAGENTS_REL));
    warnings.push(
      "openhands conversation history and app state are managed by the client and not exported; " +
        "user microagents (~/.openhands/microagents) are exported as instructions",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readConfig(home);
    const mcp = isRecord(config.mcp) ? { ...config.mcp } : {};

    const stdio: Record<string, unknown>[] = [];
    const shttp: unknown[] = [];
    const sse: unknown[] = [];
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: openhands has no disabled flag; server emitted as enabled`);
      }
      if (s.transport === "stdio") {
        if (s.cwd) warnings.push(`mcp:${s.name}: openhands does not support cwd; dropped`);
        const entry: Record<string, unknown> = { name: s.name, command: s.command };
        if (s.args?.length) entry.args = s.args;
        if (s.env && Object.keys(s.env).length) entry.env = s.env;
        stdio.push(entry);
      } else {
        const headers = s.headers ?? {};
        const auth = headers.Authorization;
        const apiKey =
          typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
        const extra = Object.keys(headers).filter((h) => h !== "Authorization");
        if (extra.length || (auth && !apiKey)) {
          warnings.push(
            `mcp:${s.name}: openhands remote servers only support api_key auth; other headers dropped`,
          );
        }
        const entry = apiKey ? { url: s.url, api_key: apiKey } : s.url;
        (s.transport === "sse" ? sse : shttp).push(entry);
      }
    }

    const existingStdio = Array.isArray(mcp.stdio_servers)
      ? (mcp.stdio_servers.filter(isRecord) as Record<string, unknown>[])
      : [];
    const existingByName = Object.fromEntries(
      existingStdio.filter((e) => typeof e.name === "string").map((e) => [e.name as string, e]),
    );
    const importedByName = Object.fromEntries(stdio.map((e) => [e.name as string, e]));
    const mergedStdio = mergeMcpRecords(
      existingByName,
      importedByName,
      warnings,
      opts?.replaceMcp ?? false,
    );
    mcp.stdio_servers = Object.values(mergedStdio);

    const mergeList = (existing: unknown, imported: unknown[]): unknown[] => {
      const base =
        !opts?.replaceMcp && Array.isArray(existing) ? [...(existing as unknown[])] : [];
      for (const entry of imported) {
        const url = typeof entry === "string" ? entry : (entry as { url: string }).url;
        const dup = base.some(
          (e) => (typeof e === "string" ? e : isRecord(e) ? e.url : undefined) === url,
        );
        if (!dup) base.push(entry);
      }
      return base;
    };
    mcp.shttp_servers = mergeList(mcp.shttp_servers, shttp);
    mcp.sse_servers = mergeList(mcp.sse_servers, sse);
    if ((mcp.shttp_servers as unknown[]).length === 0) delete mcp.shttp_servers;
    if ((mcp.sse_servers as unknown[]).length === 0) delete mcp.sse_servers;
    if ((mcp.stdio_servers as unknown[]).length === 0) delete mcp.stdio_servers;
    config.mcp = mcp;

    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: CONFIG_REL, content: stringifyToml(config) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: openhands has no persona file; appended to a user microagent (approximated)",
      );
    }
    if (parts.length) {
      files.push({
        path: `${MICROAGENTS_REL}/agentmove-imported.md`,
        content: parts.join("\n\n") + "\n",
      });
    }

    if (bundle.memory.length) {
      warnings.push("memory: openhands has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
