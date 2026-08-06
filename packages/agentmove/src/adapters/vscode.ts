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
import { exists, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * VS Code (Copilot agent mode). User-profile MCP servers live in mcp.json
 * under a `servers` map — stdio entries use command/args/env (type optional),
 * remote entries use `type: "http"`/`"sse"` + url/headers. The profile folder
 * is platform-specific: ~/.config/Code/User (Linux),
 * ~/Library/Application Support/Code/User (macOS), %APPDATA%\Code\User
 * (Windows). An optional top-level `inputs` array defines prompted
 * placeholders and is preserved untouched on merge.
 */
const CANDIDATE_RELS = [
  ".config/Code/User/mcp.json",
  "Library/Application Support/Code/User/mcp.json",
  "AppData/Roaming/Code/User/mcp.json",
];

function platformDefaultRel(): string {
  if (process.platform === "darwin") return CANDIDATE_RELS[1]!;
  if (process.platform === "win32") return CANDIDATE_RELS[2]!;
  return CANDIDATE_RELS[0]!;
}

async function findConfigRel(home: string): Promise<string | undefined> {
  for (const rel of CANDIDATE_RELS) {
    if (await exists(path.join(home, rel))) return rel;
  }
  return undefined;
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseVscodeServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.servers) ? config.servers : {};
  const servers: McpServer[] = [];
  for (const [name, rawEntry] of Object.entries(serversObj)) {
    let entry = rawEntry;
    if (isRecord(entry) && typeof entry.envFile === "string") {
      warnings.push(`mcp:${name}: vscode envFile reference is machine-specific; dropped`);
      entry = { ...entry, envFile: undefined };
    }
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (s) servers.push(s);
  }
  return servers;
}

export function renderVscodeServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: vscode has no disabled flag in mcp.json; server emitted as enabled`);
    }
    out[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined }, s.transport !== "stdio");
  }
  return out;
}

export const vscode: ClientAdapter = {
  id: "vscode",
  label: "VS Code",
  defaultPath: "~/.config/Code/User/mcp.json (or the macOS/Windows profile folder)",

  async detect(home) {
    return (await findConfigRel(home)) !== undefined;
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "vscode";

    const rel = await findConfigRel(home);
    const config = rel ? await readJsonMap(path.join(home, rel)) : {};
    bundle.config.raw = config;
    if (Array.isArray(config.inputs) && config.inputs.length) {
      warnings.push(
        "mcp: vscode inputs (prompted placeholders) are client-specific; ${input:*} references stay as-is",
      );
    }
    bundle.mcpServers = parseVscodeServers(config, warnings);
    warnings.push(
      "vscode instructions/prompts/chat modes are profile- or repo-scoped; only user MCP servers migrate (use --project for .vscode/mcp.json)",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const rel = (await findConfigRel(home)) ?? platformDefaultRel();
    const config = await readJsonMap(path.join(home, rel));
    const existing = isRecord(config.servers) ? config.servers : {};
    config.servers = mergeMcpRecords(
      existing,
      renderVscodeServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: vscode user instructions are profile-managed; skipped (use --project for .github/copilot-instructions.md)",
      );
    }
    if (bundle.persona) warnings.push("persona: vscode has no persona file; skipped");
    if (bundle.memory.length) warnings.push("memory: vscode has no durable memory store; skipped");
    if (bundle.skills.length) warnings.push("skills: vscode has no SKILL.md mechanism; skipped");
    return { files, warnings };
  },
};
