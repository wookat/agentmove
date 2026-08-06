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
import { exists, isDir, readText } from "../fsutil.js";
import {
  mergeMcpRecords,
  parseCommonMcpEntry,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Amazon Q Developer CLI (q chat). MCP servers live under the `mcpServers`
 * key of ~/.aws/amazonq/mcp.json (the "legacy global" config every agent can
 * opt into via useLegacyMcpJson; the built-in default agent does). `type` is
 * stdio or http (stdio may omit it); stdio uses command/args/env, remote uses
 * url/headers plus OAuth handled by the CLI; native `disabled` flag. Agents
 * themselves are JSON files under cli-agents/ and are not migrated.
 */
const MCP_REL = ".aws/amazonq/mcp.json";

const CLIENT_KEYS = ["timeout", "oauth", "oauthScopes"] as const;

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

export function parseAmazonqServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (isRecord(entry)) {
      if (entry.disabled === true) s.enabled = false;
      for (const key of CLIENT_KEYS) {
        if (entry[key] !== undefined) {
          warnings.push(`mcp:${name}: amazonq ${key} setting is client-specific; not migrated`);
        }
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderAmazonqServers(bundle: Bundle, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    const src: McpServer = { ...s, enabled: undefined };
    if (src.transport === "sse") {
      warnings.push(`mcp:${s.name}: amazonq has no sse transport type; written as http (the CLI falls back to SSE on handshake)`);
      src.transport = "http";
    }
    const entry = renderCommonMcpEntry(src, true);
    if (s.enabled === false) entry.disabled = true;
    out[s.name] = entry;
  }
  return out;
}

export const amazonq: ClientAdapter = {
  id: "amazonq",
  label: "Amazon Q Developer CLI",
  defaultPath: "~/.aws/amazonq/mcp.json",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".aws/amazonq")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "amazonq";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseAmazonqServers(config, warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAmazonqServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    if (bundle.instructions) {
      warnings.push(
        "instructions: amazonq user-level context lives in agent JSON files (cli-agents/); use --project to write AmazonQ.md",
      );
    }
    if (bundle.persona) {
      warnings.push("persona: amazonq has no persona file; skipped (use --project for AmazonQ.md)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: amazonq /knowledge store is app-managed; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: amazonq has no SKILL.md mechanism; skipped");
    }
    return { files, warnings };
  },
};
