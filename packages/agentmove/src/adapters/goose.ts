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
  parseFile,
  stringArgs,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

/**
 * goose (Block). MCP servers are "extensions" in ~/.config/goose/config.yaml
 * (stdio uses `cmd`/`args`/`envs`, remote uses `streamable_http`/`sse` with
 * `uri`); global instructions are ~/.config/goose/.goosehints; the memory
 * extension stores durable memories as <category>.txt files under
 * ~/.config/goose/memory/; skills follow the ~/.agents/skills standard.
 */
const CONFIG_REL = ".config/goose/config.yaml";
const HINTS_REL = ".config/goose/.goosehints";
const MEMORY_REL = ".config/goose/memory";
const SKILLS_REL = ".agents/skills";
const DEFAULT_TIMEOUT = 300;

const NON_MCP_TYPES = ["builtin", "platform", "frontend", "inline_python"];

async function readConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, CONFIG_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseYaml);
  return isRecord(data) ? data : {};
}

export function fromGooseExtension(
  name: string,
  entry: unknown,
  warnings: string[],
): McpServer | undefined {
  if (!isRecord(entry)) {
    warnings.push(`mcp:${name}: entry is not an object; dropped`);
    return undefined;
  }
  const type = typeof entry.type === "string" ? entry.type : "stdio";
  if (NON_MCP_TYPES.includes(type)) return undefined;
  if (Array.isArray(entry.available_tools) && entry.available_tools.length) {
    warnings.push(`mcp:${name}: goose available_tools filter has no portable equivalent; dropped`);
  }
  if (Array.isArray(entry.env_keys) && entry.env_keys.length) {
    warnings.push(`mcp:${name}: goose env_keys reference keyring secrets; not exported`);
  }
  if (typeof entry.timeout === "number" && entry.timeout !== DEFAULT_TIMEOUT) {
    warnings.push(`mcp:${name}: goose per-extension timeout has no portable equivalent; dropped`);
  }
  const enabled = entry.enabled === false ? false : undefined;
  if (type === "stdio") {
    const command = typeof entry.cmd === "string" ? entry.cmd : undefined;
    if (!command) {
      warnings.push(`mcp:${name}: stdio extension without a cmd; dropped`);
      return undefined;
    }
    return {
      name,
      transport: "stdio",
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.envs, `mcp:${name}.envs`, warnings),
      enabled,
    };
  }
  const url = typeof entry.uri === "string" ? entry.uri : undefined;
  if (!url) {
    warnings.push(`mcp:${name}: remote extension without a uri; dropped`);
    return undefined;
  }
  return {
    name,
    transport: type === "sse" ? "sse" : "http",
    url,
    headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
    enabled,
  };
}

export function toGooseExtension(s: McpServer, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { name: s.name, enabled: s.enabled !== false, timeout: DEFAULT_TIMEOUT };
  if (s.transport === "stdio") {
    out.type = "stdio";
    out.cmd = s.command ?? "";
    out.args = s.args ?? [];
    if (s.env) out.envs = s.env;
    if (s.cwd) warnings.push(`mcp:${s.name}: goose does not support cwd; dropped`);
  } else {
    out.type = s.transport === "sse" ? "sse" : "streamable_http";
    if (s.url) out.uri = s.url;
    if (s.headers) out.headers = s.headers;
  }
  return out;
}

export function parseGooseMemoryFile(content: string, source: string): MemoryEntry[] {
  return content
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((l) => !l.startsWith("# "))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .map((entryContent) => ({ content: entryContent, source, kind: "long-term" as const }));
}

export const goose: ClientAdapter = {
  id: "goose",
  label: "goose",
  defaultPath: "~/.config/goose (config.yaml + .goosehints + memory/)",

  async detect(home) {
    return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, ".config/goose")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "goose";

    const config = await readConfig(home);
    bundle.config.raw = config;
    const extensions = isRecord(config.extensions) ? config.extensions : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(extensions)) {
      const s = fromGooseExtension(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, HINTS_REL));

    const memoryDir = path.join(home, MEMORY_REL);
    if (await isDir(memoryDir)) {
      for (const file of (await listDir(memoryDir)).sort()) {
        if (!file.endsWith(".txt")) continue;
        const content = await readText(path.join(memoryDir, file));
        if (content) bundle.memory.push(...parseGooseMemoryFile(content, `goose-memory/${file}`));
      }
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readConfig(home);
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) rendered[s.name] = toGooseExtension(s, warnings);
    const existing = isRecord(config.extensions) ? config.extensions : {};
    config.extensions = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: CONFIG_REL, content: stringifyYaml(config) });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: goose has no persona file; appended to ~/.config/goose/.goosehints (approximated)");
    }
    if (parts.length) files.push({ path: HINTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      files.push({
        path: `${MEMORY_REL}/imported.txt`,
        content: bundle.memory.map((e) => e.content.trim()).join("\n\n") + "\n",
      });
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
