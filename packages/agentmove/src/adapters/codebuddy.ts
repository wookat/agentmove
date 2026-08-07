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
  appendSections,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./shared.js";

/**
 * CodeBuddy Code (Tencent CLI coding agent). User-scoped MCP servers live
 * under the `mcpServers` key of ~/.codebuddy/.mcp.json (recommended), with
 * ~/.codebuddy/mcp.json (deprecated) and ~/.codebuddy.json (legacy) as
 * read fallbacks — the file may be JSONC. Entries use the common notation
 * (`type` stdio/sse/http optional and inferred; stdio uses command/args/env,
 * remote uses url/headers) plus a top-level `disabledMcpServers` name list.
 * User memory lives in ~/.codebuddy/CODEBUDDY.md and user skills follow the
 * open Agent Skills standard under ~/.codebuddy/skills/.
 */
const MCP_CANDIDATES = [".codebuddy/.mcp.json", ".codebuddy/mcp.json", ".codebuddy.json"] as const;
const MEMORY_REL = ".codebuddy/CODEBUDDY.md";
const SKILLS_REL = ".codebuddy/skills";

export async function readCodebuddyMcp(
  candidates: string[],
  warnings: string[],
): Promise<{ config: Record<string, unknown>; file: string }> {
  for (const file of candidates) {
    const raw = await readText(file);
    if (raw === undefined) continue;
    const data = parseFile<unknown>(file, raw, (s) => JSON5.parse(s) as unknown);
    if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
      warnings.push(`codebuddy ${path.basename(file)}: existing JSONC comments are not preserved on rewrite`);
    }
    return { config: isRecord(data) ? data : {}, file };
  }
  return { config: {}, file: candidates[0]! };
}

export function parseCodebuddyServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const disabled = new Set(
    Array.isArray(config.disabledMcpServers)
      ? config.disabledMcpServers.filter((n): n is string => typeof n === "string")
      : [],
  );
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    if (disabled.has(name)) s.enabled = false;
    if (isRecord(entry) && entry.description !== undefined) {
      warnings.push(`mcp:${name}: codebuddy description is client-specific; not migrated`);
    }
    servers.push(s);
  }
  return servers;
}

export function renderCodebuddyServers(
  bundle: Bundle,
  warnings: string[],
): { servers: Record<string, unknown>; disabled: string[] } {
  const servers: Record<string, unknown> = {};
  const disabled: string[] = [];
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) disabled.push(s.name);
    if (s.cwd) warnings.push(`mcp:${s.name}: codebuddy does not support cwd; dropped`);
    servers[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, true);
  }
  return { servers, disabled };
}

export async function planCodebuddyMcp(
  bundle: Bundle,
  mcpCandidates: string[],
  mcpRels: string[],
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const { config, file } = await readCodebuddyMcp(mcpCandidates, warnings);
  const rel = mcpRels[mcpCandidates.indexOf(file)]!;
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  const { servers, disabled } = renderCodebuddyServers(bundle, warnings);
  config.mcpServers = mergeMcpRecords(existing, servers, warnings, replaceMcp);
  const existingDisabled = Array.isArray(config.disabledMcpServers)
    ? config.disabledMcpServers.filter((n): n is string => typeof n === "string")
    : [];
  const mergedDisabled = replaceMcp
    ? disabled
    : [...new Set([...existingDisabled, ...disabled])];
  if (mergedDisabled.length) config.disabledMcpServers = mergedDisabled;
  else delete config.disabledMcpServers;
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export const codebuddy: ClientAdapter = {
  id: "codebuddy",
  label: "CodeBuddy",
  defaultPath: "~/.codebuddy (.mcp.json + CODEBUDDY.md + skills/)",

  async detect(home) {
    return (
      (await isDir(path.join(home, ".codebuddy"))) ||
      (await exists(path.join(home, ".codebuddy.json")))
    );
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "codebuddy";

    const { config } = await readCodebuddyMcp(
      MCP_CANDIDATES.map((rel) => path.join(home, rel)),
      warnings,
    );
    bundle.config.raw = config;
    bundle.mcpServers = parseCodebuddyServers(config, warnings);
    bundle.instructions = await readText(path.join(home, MEMORY_REL));
    if (await isDir(path.join(home, ".codebuddy/rules"))) {
      warnings.push(
        "instructions: ~/.codebuddy/rules/*.md are client-specific rule files; not exported (only CODEBUDDY.md is)",
      );
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planCodebuddyMcp(
        bundle,
        MCP_CANDIDATES.map((rel) => path.join(home, rel)),
        [...MCP_CANDIDATES],
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        "persona: codebuddy has no persona file; appended to ~/.codebuddy/CODEBUDDY.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: MEMORY_REL, content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: codebuddy auto-memory is app-managed; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
