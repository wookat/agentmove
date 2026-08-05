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
import { mergeMcpRecords, parseCommonMcpEntry, renderCommonMcpEntry, touchesMcpConfig } from "./shared.js";

const MCP_REL = ".cursor/mcp.json";

export const cursor: ClientAdapter = {
  id: "cursor",
  label: "Cursor",
  defaultPath: "~/.cursor/mcp.json (rules & memories are project/app-scoped)",

  async detect(home) {
    return (await exists(path.join(home, MCP_REL))) || (await isDir(path.join(home, ".cursor")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cursor";

    const file = path.join(home, MCP_REL);
    const raw = await readText(file);
    if (raw !== undefined) {
      const data = parseFile<unknown>(file, raw, JSON.parse);
      const serversObj = isRecord(data) && isRecord(data.mcpServers) ? data.mcpServers : {};
      const servers: McpServer[] = [];
      for (const [name, entry] of Object.entries(serversObj)) {
        const s = parseCommonMcpEntry(name, entry, warnings);
        if (s) servers.push(s);
      }
      bundle.mcpServers = servers;
    }
    warnings.push(
      "cursor rules live per-project (.cursor/rules/*.mdc) and memories in the app database; " +
        "only global MCP servers are exported — run agentmove in a project for project rules (planned)",
    );
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const file = path.join(home, MCP_REL);
    const raw = await readText(file);
    let existingConfig: Record<string, unknown> = {};
    if (raw !== undefined) {
      const data = parseFile<unknown>(file, raw, JSON.parse);
      if (isRecord(data)) existingConfig = data;
    }
    const mcpServers: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: cursor has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: cursor does not support cwd; dropped`);
      mcpServers[s.name] = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
    }
    const existing = isRecord(existingConfig.mcpServers) ? existingConfig.mcpServers : {};
    existingConfig.mcpServers = mergeMcpRecords(existing, mcpServers, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: MCP_REL, content: JSON.stringify(existingConfig, null, 2) + "\n" });
    }

    if (bundle.instructions || bundle.persona) {
      const body = [
        "---",
        "alwaysApply: true",
        "---",
        "",
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""] : []),
      ].join("\n");
      files.push({ path: ".cursor/rules/agentmove-imported.mdc", content: body });
      warnings.push(
        "instructions/persona: written to ~/.cursor/rules/agentmove-imported.mdc; " +
          "cursor primarily reads project-level .cursor/rules — copy it into your projects as needed (approximated)",
      );
    }
    if (bundle.memory.length) {
      warnings.push("memory: cursor memories are app-managed and cannot be imported; skipped");
    }
    if (bundle.skills.length) {
      warnings.push("skills: cursor has no skills directory; skipped (consider converting to rules manually)");
    }
    return { files, warnings };
  },
};
