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
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * JetBrains AI Assistant (IntelliJ-family IDEs). User-scoped MCP servers live
 * under the `mcpServers` key of ~/.ai/mcp/mcp.json, a file shared by the
 * JetBrains AI agents (AI Assistant and the bundled third-party agents).
 * Entries use the common notation without a `type` field: stdio uses
 * command/args/env plus an optional native `workingDirectory`, remote uses
 * url/headers (Streamable HTTP). Servers are toggled in the IDE settings UI,
 * not via a JSON flag. Rules, prompts, and chat history are IDE-managed;
 * project rules live in .aiassistant/rules/*.md (--project). Junie is a
 * separate JetBrains product with its own ~/.junie files (see the junie
 * client).
 */
const MCP_REL = ".ai/mcp/mcp.json";

export async function readJetbrainsMcp(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

export function parseJetbrainsServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (!s.cwd && isRecord(entry) && typeof entry.workingDirectory === "string") {
      s.cwd = entry.workingDirectory;
    }
    servers.push(s);
  }
  return servers;
}

export function renderJetbrainsServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(
        `mcp:${s.name}: jetbrains has no disabled flag in mcp.json (toggled in the IDE settings UI); server emitted as enabled`,
      );
    }
    if (s.transport === "sse") {
      warnings.push(
        `mcp:${s.name}: jetbrains remote servers are plain url entries (Streamable HTTP); sse written without a transport type`,
      );
    }
    const out = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, false);
    if (s.transport === "stdio" && s.cwd) out.workingDirectory = s.cwd;
    servers[s.name] = out;
  }
  return servers;
}

export async function planJetbrainsMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readJetbrainsMcp(file);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers = renderJetbrainsServers(bundle, warnings);
  config.mcpServers = mergeMcpRecords(existing, servers, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

/** Read project rules (.aiassistant/rules/*.md) merged into one document. */
export async function readJetbrainsRulesDir(
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
    warnings.push("instructions: jetbrains project rules files merged into one document");
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const jetbrains: ClientAdapter = {
  id: "jetbrains",
  label: "JetBrains AI Assistant",
  defaultPath: "~/.ai/mcp/mcp.json (rules: --project)",

  async detect(home) {
    return exists(path.join(home, MCP_REL));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "jetbrains";

    const config = await readJetbrainsMcp(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseJetbrainsServers(config, warnings);
    warnings.push(
      "instructions: jetbrains rules are project-scoped (.aiassistant/rules/); nothing exported at user scope (use --project)",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planJetbrainsMcp(
        bundle,
        path.join(home, MCP_REL),
        MCP_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    if (bundle.instructions) {
      warnings.push(
        "instructions: jetbrains rules are project-scoped (.aiassistant/rules/); skipped at user scope (use --project)",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: jetbrains has no user-scoped persona file; skipped (use --project)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: jetbrains chat memory is IDE-managed; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: jetbrains has no Agent Skills directory; skipped");
    }
    return { files, warnings };
  },
};
