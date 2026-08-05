import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
  MemoryEntry,
  MemoryKind,
  parseFile,
  stringArgs,
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planSkills, readSkillsDir } from "./shared.js";

const CONFIG_REL = ".hermes/config.yaml";

/** Hermes memory files use `§` as the entry delimiter. */
function parseEntries(content: string, source: string, kind: MemoryKind): MemoryEntry[] {
  return content
    .split("§")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((content) => ({ content, source, kind }));
}

function renderEntries(entries: MemoryEntry[]): string {
  return entries.map((e) => e.content.trim()).join("\n§\n") + "\n";
}

async function readConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, CONFIG_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseYaml);
  return isRecord(data) ? data : {};
}

function parseMcp(config: Record<string, unknown>, warnings: string[]): McpServer[] {
  const serversObj = isRecord(config.mcp_servers) ? config.mcp_servers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    if (!isRecord(entry)) {
      warnings.push(`mcp:${name}: entry is not an object; dropped`);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const command = typeof entry.command === "string" ? entry.command : undefined;
    if (!url && !command) {
      warnings.push(`mcp:${name}: neither command nor url; dropped`);
      continue;
    }
    if (entry.tools !== undefined) {
      warnings.push(`mcp:${name}: hermes tools include/exclude filter has no portable equivalent; dropped`);
    }
    servers.push({
      name,
      transport: url ? "http" : "stdio",
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      url,
    });
  }
  return servers;
}

function renderMcp(servers: McpServer[], warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of servers) {
    const entry: Record<string, unknown> = {};
    if (s.transport === "stdio") {
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) entry.cwd = s.cwd;
    } else {
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) {
        warnings.push(`mcp:${s.name}: hermes config has no documented headers field; headers dropped`);
      }
    }
    out[s.name] = entry;
  }
  return out;
}

export const hermes: ClientAdapter = {
  id: "hermes",
  label: "Hermes Agent",
  defaultPath: "~/.hermes",

  async detect(home) {
    return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, ".hermes")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "hermes";

    const config = await readConfig(home);
    if (typeof config.model === "string") bundle.config.model = config.model;
    else if (isRecord(config.model) && typeof config.model.primary === "string") {
      bundle.config.model = config.model.primary;
    }
    bundle.config.raw = config;
    bundle.mcpServers = parseMcp(config, warnings);

    bundle.persona = await readText(path.join(home, ".hermes/SOUL.md"));
    bundle.instructions = await readText(path.join(home, ".hermes/AGENTS.md"));

    const memory: MemoryEntry[] = [];
    const longTerm = await readText(path.join(home, ".hermes/memories/MEMORY.md"));
    if (longTerm) memory.push(...parseEntries(longTerm, "memories/MEMORY.md", "long-term"));
    const user = await readText(path.join(home, ".hermes/memories/USER.md"));
    if (user) memory.push(...parseEntries(user, "memories/USER.md", "user-profile"));
    bundle.memory = memory;

    bundle.skills = await readSkillsDir(path.join(home, ".hermes/skills"), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readConfig(home);
    const existing = isRecord(config.mcp_servers) ? config.mcp_servers : {};
    config.mcp_servers = mergeMcpRecords(
      existing,
      renderMcp(bundle.mcpServers, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (bundle.config.model) config.model = bundle.config.model;
    files.push({ path: CONFIG_REL, content: stringifyYaml(config) });

    if (bundle.persona) files.push({ path: ".hermes/SOUL.md", content: bundle.persona });
    if (bundle.instructions) files.push({ path: ".hermes/AGENTS.md", content: bundle.instructions });

    const longTerm = bundle.memory.filter((e) => e.kind !== "user-profile");
    const user = bundle.memory.filter((e) => e.kind === "user-profile");
    if (longTerm.length) {
      files.push({ path: ".hermes/memories/MEMORY.md", content: renderEntries(longTerm) });
    }
    if (user.length) files.push({ path: ".hermes/memories/USER.md", content: renderEntries(user) });

    files.push(...planSkills(bundle.skills, ".hermes/skills/agentmove-imports"));
    return { files, warnings };
  },
};
