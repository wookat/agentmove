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
 * GitHub Copilot CLI (also read by the VS Code Copilot Agent Host). User-level
 * MCP servers live in ~/.copilot/mcp-config.json under an `mcpServers` map;
 * stdio servers are spelled `"type": "local"`, remote ones `"http"`/`"sse"`.
 * User instructions are ~/.copilot/copilot-instructions.md plus modular
 * ~/.copilot/instructions/*.instructions.md files.
 */
const MCP_REL = ".copilot/mcp-config.json";
const INSTRUCTIONS_FILE_REL = ".copilot/copilot-instructions.md";
const INSTRUCTIONS_DIR_REL = ".copilot/instructions";

async function readMcpConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, MCP_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

/** Map Copilot's `local` transport spelling to the portable `stdio`. */
function normalizeEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const out = { ...entry };
  if (out.type === "local") out.type = "stdio";
  return out;
}

export const copilot: ClientAdapter = {
  id: "copilot",
  label: "GitHub Copilot CLI",
  defaultPath: "~/.copilot (mcp-config.json + copilot-instructions.md)",

  async detect(home) {
    return (
      (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".copilot")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "copilot";

    const config = await readMcpConfig(home);
    bundle.config.raw = config;
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, normalizeEntry(entry), warnings);
      if (!s) continue;
      if (isRecord(entry) && Array.isArray(entry.tools)) {
        const tools = entry.tools.map(String);
        if (!(tools.length === 1 && tools[0] === "*")) {
          warnings.push(
            `mcp:${name}: copilot tool allowlist [${tools.join(", ")}] is client-specific; dropped`,
          );
        }
      }
      servers.push(s);
    }
    bundle.mcpServers = servers;

    const parts: string[] = [];
    const main = await readText(path.join(home, INSTRUCTIONS_FILE_REL));
    if (main?.trim()) parts.push(`<!-- copilot-instructions.md -->\n${main.trim()}`);
    const dir = path.join(home, INSTRUCTIONS_DIR_REL);
    if (await isDir(dir)) {
      for (const name of (await listDir(dir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const content = await readText(path.join(dir, name));
        if (content?.trim()) parts.push(`<!-- instructions/${name} -->\n${content.trim()}`);
      }
    }
    if (parts.length) bundle.instructions = parts.join("\n\n") + "\n";

    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readMcpConfig(home);
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.cwd) warnings.push(`mcp:${s.name}: copilot does not support cwd; dropped`);
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: copilot has no disabled flag; server emitted as enabled`);
      }
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      entry.type = s.transport === "stdio" ? "local" : s.transport;
      mcpServers[s.name] = entry;
    }
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: copilot has no persona file; appended to a user instructions file (approximated)",
      );
    }
    if (parts.length) {
      files.push({
        path: `${INSTRUCTIONS_DIR_REL}/agentmove-imported.instructions.md`,
        content: parts.join("\n\n") + "\n",
      });
    }

    if (bundle.memory.length) {
      warnings.push("memory: copilot has no durable memory store; skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push(
        "skills: copilot has no SKILL.md mechanism; skipped (consider converting to instructions manually)",
      );
    }
    return { files, warnings };
  },
};
