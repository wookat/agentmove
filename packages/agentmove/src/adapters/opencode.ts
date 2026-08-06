import path from "node:path";
import JSON5 from "json5";
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
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * OpenCode. MCP servers live under the `mcp` key of
 * ~/.config/opencode/opencode.json (opencode.jsonc also accepted): local
 * servers use `type: "local"` with `command` as an argv array plus
 * `environment`, remote servers use `type: "remote"` + `url`; both take an
 * `enabled` boolean. Instructions are ~/.config/opencode/AGENTS.md and
 * skills are native SKILL.md directories under ~/.config/opencode/skills/.
 */
const CONFIG_DIR_REL = ".config/opencode";
const CONFIG_REL = ".config/opencode/opencode.json";
const CONFIG_JSONC_REL = ".config/opencode/opencode.jsonc";
const AGENTS_REL = ".config/opencode/AGENTS.md";
const SKILLS_REL = ".config/opencode/skills";

async function readConfig(
  home: string,
  warnings: string[],
): Promise<{ config: Record<string, unknown>; rel: string }> {
  for (const rel of [CONFIG_REL, CONFIG_JSONC_REL]) {
    const file = path.join(home, rel);
    const raw = await readText(file);
    if (raw === undefined) continue;
    const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
    if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
      warnings.push(`opencode ${path.basename(rel)}: existing comments are not preserved on rewrite`);
    }
    return { config: isRecord(data) ? data : {}, rel };
  }
  return { config: {}, rel: CONFIG_REL };
}

/** Normalize an OpenCode entry into the common shape parseCommonMcpEntry understands. */
export function fromOpencodeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out: Record<string, unknown> = { ...entry };
  if (out.type === "local") out.type = "stdio";
  if (out.type === "remote") out.type = "http";
  if (Array.isArray(out.command) && out.command.every((c) => typeof c === "string")) {
    const [cmd, ...args] = out.command as string[];
    out.command = cmd;
    if (args.length && out.args === undefined) out.args = args;
  }
  if (isRecord(out.environment) && out.env === undefined) {
    out.env = out.environment;
    delete out.environment;
  }
  return out;
}

/** Render a portable server into OpenCode's spelling. */
export function toOpencodeEntry(s: McpServer, warnings: string[]): Record<string, unknown> {
  const common = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
  const out: Record<string, unknown> = {};
  if (s.transport === "stdio") {
    out.type = "local";
    out.command = [s.command ?? "", ...(s.args ?? [])].filter((c) => c !== "");
    if (isRecord(common.env)) out.environment = common.env;
  } else {
    if (s.transport === "sse") {
      warnings.push(`mcp:${s.name}: opencode has no sse type; emitted as remote`);
    }
    out.type = "remote";
    if (s.url) out.url = s.url;
    if (isRecord(common.headers)) out.headers = common.headers;
  }
  if (s.cwd) warnings.push(`mcp:${s.name}: opencode does not support cwd; dropped`);
  if (s.enabled === false) out.enabled = false;
  return out;
}

export const opencode: ClientAdapter = {
  id: "opencode",
  label: "OpenCode",
  defaultPath: "~/.config/opencode (opencode.json + AGENTS.md + skills/)",

  async detect(home) {
    return (
      (await exists(path.join(home, CONFIG_REL))) ||
      (await exists(path.join(home, CONFIG_JSONC_REL))) ||
      (await isDir(path.join(home, CONFIG_DIR_REL)))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "opencode";

    const { config } = await readConfig(home, []);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcp) ? config.mcp : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, fromOpencodeEntry(entry), warnings);
      if (s) {
        if (isRecord(entry) && entry.enabled === false) s.enabled = false;
        servers.push(s);
      }
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const { config, rel } = await readConfig(home, warnings);
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      rendered[s.name] = toOpencodeEntry(s, warnings);
    }
    const existing = isRecord(config.mcp) ? config.mcp : {};
    config.mcp = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: opencode has no persona file; appended to ~/.config/opencode/AGENTS.md (approximated)",
      );
    }
    if (parts.length) files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });

    files.push(...planSkills(bundle.skills, SKILLS_REL));

    if (bundle.memory.length) {
      warnings.push("memory: opencode has no durable memory store; skipped (consider --mif)");
    }
    return { files, warnings };
  },
};
