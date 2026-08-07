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
import { isDir, listDir, readText } from "../fsutil.js";
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
 * Augment Code — Auggie CLI. User-scoped MCP servers live under the
 * `mcpServers` key of ~/.augment/settings.json (a general settings file whose
 * other keys must be preserved). Entries use the common notation: `type` is
 * optional (stdio default) with stdio/sse/http; stdio uses command/args/env,
 * remote uses url/headers. There is no per-server disabled flag. User rules
 * are markdown files under ~/.augment/rules/ (always applied), and skills
 * follow the agentskills.io Agent Skills standard under ~/.augment/skills/.
 */
const SETTINGS_REL = ".augment/settings.json";
const RULES_REL = ".augment/rules";
const SKILLS_REL = ".augment/skills";

export async function readAuggieSettings(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (s) => JSON.parse(s) as unknown);
  return isRecord(data) ? data : {};
}

export function parseAuggieServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (!s) continue;
    servers.push(s);
  }
  return servers;
}

export function renderAuggieServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: auggie has no disabled flag; imported as enabled`);
    }
    if (s.cwd) warnings.push(`mcp:${s.name}: auggie does not support cwd; dropped`);
    servers[s.name] = renderCommonMcpEntry({ ...s, enabled: undefined, cwd: undefined }, true);
  }
  return servers;
}

export async function planAuggieMcp(
  bundle: Bundle,
  file: string,
  rel: string,
  warnings: string[],
  replaceMcp: boolean,
): Promise<FilePlan[]> {
  const files: FilePlan[] = [];
  const config = await readAuggieSettings(file);
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
  const servers = renderAuggieServers(bundle, warnings);
  config.mcpServers = mergeMcpRecords(existing, servers, warnings, replaceMcp);
  if (touchesMcpConfig(bundle.mcpServers.length, replaceMcp)) {
    files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
  }
  return files;
}

export async function readAuggieRulesDir(
  root: string,
  warnings: string[],
  scope: string,
): Promise<string | undefined> {
  if (!(await isDir(root))) return undefined;
  const parts: string[] = [];
  for (const f of (await listDir(root)).sort()) {
    if (!f.endsWith(".md")) continue;
    const content = await readText(path.join(root, f));
    if (content?.trim()) parts.push(`<!-- rule: ${f} -->\n${content.trim()}`);
  }
  if (parts.length > 1) {
    warnings.push(`instructions: auggie ${scope} rules files merged into one document`);
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

export const auggie: ClientAdapter = {
  id: "auggie",
  label: "Auggie CLI",
  defaultPath: "~/.augment (settings.json + rules/ + skills/)",

  async detect(home) {
    return isDir(path.join(home, ".augment"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "auggie";

    const config = await readAuggieSettings(path.join(home, SETTINGS_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseAuggieServers(config, warnings);
    bundle.instructions = await readAuggieRulesDir(path.join(home, RULES_REL), warnings, "user");
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    files.push(
      ...(await planAuggieMcp(
        bundle,
        path.join(home, SETTINGS_REL),
        SETTINGS_REL,
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push(
        "persona: auggie has no persona file; appended to ~/.augment/rules/agentmove.md (approximated)",
      );
    }
    if (bundle.instructions || sections.length) {
      files.push({
        path: `${RULES_REL}/agentmove.md`,
        content: appendSections(bundle.instructions, sections),
      });
    }
    if (bundle.memory.length) {
      warnings.push("memory: auggie memories are app-managed; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
