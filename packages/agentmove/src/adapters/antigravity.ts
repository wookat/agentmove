import path from "node:path";
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
import { exists, isDir, listDir, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  planCommandsFlat,
  planSkills,
  readAgentsDir,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Google Antigravity (Antigravity 2.0 / IDE / CLI). MCP servers live under the
 * `mcpServers` key of ~/.gemini/config/mcp_config.json (stdio:
 * command/args/env/cwd; remote servers must use `serverUrl` — legacy
 * url/httpUrl are not supported — plus `headers`; native `disabled` flag).
 * Global Agent Skills live in ~/.gemini/config/skills/. Global rules live in
 * ~/.gemini/GEMINI.md, which is shared with Gemini CLI — the instructions
 * layer is owned by the `gemini` client to avoid double writes. Workflows are
 * flat markdown files in ~/.gemini/config/global_workflows/ (global) or
 * .agents/workflows/ (workspace), triggered as /name slash commands in AGY
 * and AGY IDE (AGY CLI lists them but cannot trigger them).
 */
const MCP_REL = ".gemini/config/mcp_config.json";
const SKILLS_REL = ".gemini/config/skills";
const WORKFLOWS_REL = ".gemini/config/global_workflows";

const CLIENT_KEYS = ["disabledTools", "authProviderType", "oauth"] as const;

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

/** Antigravity remote servers use `serverUrl`; normalize to `url` before parsing. */
function normalizeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  if (typeof entry.serverUrl === "string" && entry.url === undefined) {
    const { serverUrl, ...rest } = entry;
    return { ...rest, url: serverUrl };
  }
  return entry;
}

export function parseAntigravityServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, normalizeEntry(entry), warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (entry[key] !== undefined) {
          warnings.push(
            `mcp:${name}: antigravity ${key} setting is client-specific; not migrated`,
          );
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderAntigravityServers(bundle: Bundle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const entry = renderCommonMcpEntry({ ...s, enabled: undefined }, false);
    if (typeof entry.url === "string") {
      const { url, ...rest } = entry;
      out[s.name] = { ...rest, serverUrl: url, ...(s.enabled === false ? { disabled: true } : {}) };
    } else {
      if (s.enabled === false) entry.disabled = true;
      out[s.name] = entry;
    }
  }
  return out;
}

export async function readAntigravityRulesDir(
  root: string,
  warnings: string[],
): Promise<string | undefined> {
  if (!(await isDir(root))) return undefined;
  const parts: string[] = [];
  for (const f of (await listDir(root)).sort()) {
    if (!f.endsWith(".md")) continue;
    const content = await readText(path.join(root, f));
    if (content?.trim()) parts.push(`<!-- rule: ${f} -->\n${content.trim()}`);
  }
  if (parts.length > 1) {
    warnings.push("instructions: antigravity project rules files merged into one document");
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const antigravity: ClientAdapter = {
  id: "antigravity",
  label: "Antigravity",
  defaultPath: "~/.gemini/config (mcp_config.json + skills/ + global_workflows/)",
  supportsCommands: true,

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) ||
      (await isDir(path.join(home, ".gemini/config"))) ||
      (await isDir(path.join(home, ".gemini/antigravity")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "antigravity";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseAntigravityServers(config, warnings);
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readAgentsDir(path.join(home, WORKFLOWS_REL), ".md");
    warnings.push(
      "instructions: antigravity global rules live in ~/.gemini/GEMINI.md shared with Gemini CLI; use the gemini client for that layer",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAntigravityServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: antigravity global rules live in ~/.gemini/GEMINI.md shared with Gemini CLI; import into the gemini client (or use --project for .agents/rules/)",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: antigravity has no persona file; skipped");
    }
    if (bundle.memory.length) {
      warnings.push("memory: antigravity has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, WORKFLOWS_REL, "antigravity", warnings));
      warnings.push(
        "commands: workflows are triggered as /name in AGY and AGY IDE; AGY CLI lists them but cannot trigger them",
      );
    }
    return { files, warnings };
  },
};
