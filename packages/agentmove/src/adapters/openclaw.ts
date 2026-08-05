import path from "node:path";
import JSON5 from "json5";
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
  parseFile,
  stringArgs,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, mergeSkills, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

const CONFIG_REL = ".openclaw/openclaw.json";

async function findWorkspace(home: string, config: Record<string, unknown>): Promise<string | undefined> {
  const agents = isRecord(config.agents) ? config.agents : undefined;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : undefined;
  const configured = defaults && typeof defaults.workspace === "string" ? defaults.workspace : undefined;
  const candidates = configured
    ? [configured.replace(/^~(?=$|\/)/, home)]
    : [path.join(home, ".openclaw/workspace"), path.join(home, ".openclaw/workspace-main")];
  for (const c of candidates) if (await isDir(c)) return c;
  return undefined;
}

async function readConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, CONFIG_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

function parseMcp(config: Record<string, unknown>, warnings: string[]): McpServer[] {
  const mcp = isRecord(config.mcp) ? config.mcp : undefined;
  const serversObj = mcp && isRecord(mcp.servers) ? mcp.servers : {};
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
    if (entry.toolFilter !== undefined) {
      warnings.push(`mcp:${name}: openclaw toolFilter has no portable equivalent; dropped`);
    }
    servers.push({
      name,
      transport: url ? (entry.transport === "sse" ? "sse" : "http") : "stdio",
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
      cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      url,
      headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
    });
  }
  return servers;
}

function renderMcp(servers: McpServer[]): Record<string, unknown> {
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
      entry.transport = s.transport === "sse" ? "sse" : "streamable-http";
      if (s.headers && Object.keys(s.headers).length) entry.headers = s.headers;
    }
    out[s.name] = entry;
  }
  return out;
}

function configModel(config: Record<string, unknown>): string | undefined {
  const agents = isRecord(config.agents) ? config.agents : undefined;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : undefined;
  const model = defaults?.model;
  if (typeof model === "string") return model;
  if (isRecord(model) && typeof model.primary === "string") return model.primary;
  return undefined;
}

export const openclaw: ClientAdapter = {
  id: "openclaw",
  label: "OpenClaw",
  defaultPath: "~/.openclaw (workspace: ~/.openclaw/workspace)",

  async detect(home) {
    return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, ".openclaw")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "openclaw";

    const config = await readConfig(home);
    bundle.config.model = configModel(config);
    bundle.config.raw = config;
    bundle.mcpServers = parseMcp(config, warnings);

    const ws = await findWorkspace(home, config);
    if (!ws) {
      warnings.push("workspace not found (~/.openclaw/workspace[-main]); persona/memory/instructions skipped");
    } else {
      bundle.persona = await readText(path.join(ws, "SOUL.md"));
      bundle.instructions = await readText(path.join(ws, "AGENTS.md"));

      const memory: MemoryEntry[] = [];
      const longTerm = await readText(path.join(ws, "MEMORY.md"));
      if (longTerm) memory.push({ content: longTerm, source: "MEMORY.md", kind: "long-term" });
      const user = await readText(path.join(ws, "USER.md"));
      if (user) memory.push({ content: user, source: "USER.md", kind: "user-profile" });
      const dailyDir = path.join(ws, "memory");
      for (const f of (await listDir(dailyDir)).sort()) {
        const m = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(f);
        if (!m) continue;
        const content = await readText(path.join(dailyDir, f));
        if (content) memory.push({ content, source: `memory/${f}`, kind: "daily", date: m[1] });
      }
      bundle.memory = memory;

      bundle.skills = mergeSkills(
        await readSkillsDir(path.join(home, ".openclaw/skills"), warnings),
        await readSkillsDir(path.join(ws, "skills"), warnings),
      );
    }
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const configFile = path.join(home, CONFIG_REL);
    const existingRaw = await readText(configFile);
    let config: Record<string, unknown> = {};
    if (existingRaw !== undefined) {
      const parsed = parseFile<unknown>(configFile, existingRaw, (s) => JSON5.parse(s) as unknown);
      if (isRecord(parsed)) config = parsed;
      if (/(^|\s)\/\//.test(existingRaw) || existingRaw.includes("/*")) {
        warnings.push("openclaw.json: existing JSON5 comments are not preserved on rewrite");
      }
    }
    const mcp = isRecord(config.mcp) ? config.mcp : {};
    const existingServers = isRecord(mcp.servers) ? mcp.servers : {};
    config.mcp = {
      ...mcp,
      servers: mergeMcpRecords(
        existingServers,
        renderMcp(bundle.mcpServers),
        warnings,
        opts?.replaceMcp ?? false,
      ),
    };
    if (bundle.config.model) {
      const agents = isRecord(config.agents) ? config.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      config.agents = { ...agents, defaults: { ...defaults, model: bundle.config.model } };
    }
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false, bundle.config.model !== undefined)) {
      files.push({ path: CONFIG_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const wsRel = ".openclaw/workspace";
    if (bundle.persona) files.push({ path: `${wsRel}/SOUL.md`, content: bundle.persona });
    if (bundle.instructions) files.push({ path: `${wsRel}/AGENTS.md`, content: bundle.instructions });
    for (const entry of bundle.memory) {
      const target =
        entry.kind === "user-profile"
          ? `${wsRel}/USER.md`
          : entry.kind === "daily" && entry.date
            ? `${wsRel}/memory/${entry.date}.md`
            : `${wsRel}/MEMORY.md`;
      const prev = files.find((f) => f.path === target);
      if (prev) prev.content = prev.content.trimEnd() + "\n\n" + entry.content;
      else files.push({ path: target, content: entry.content });
    }
    files.push(...planSkills(bundle.skills, `${wsRel}/skills`));
    return { files, warnings };
  },
};
