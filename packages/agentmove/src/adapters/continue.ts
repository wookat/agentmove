import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
  parseCommonMcpEntry,
  planAgents,
  planSkills,
  readAgentsDirRecursive,
  readSkillsDir,
  touchesMcpConfig,
} from "./shared.js";

/**
 * Continue (continue.dev, IDE extensions + `cn` CLI). MCP servers live in the
 * `mcpServers` list (not map) of ~/.continue/config.yaml; each entry carries
 * its own `name` and remote entries use `type: sse`/`streamable-http` + `url`.
 * Global rules are markdown files under ~/.continue/rules/.
 *
 * Prompt files (slash commands) are markdown files under ~/.continue/prompts/
 * (workspace scope: .continue/prompts/), discovered recursively; a file is
 * listed as a `/` slash command when its frontmatter sets `invokable: true`.
 * Legacy `.prompt` files use the v1 prompt-file format and are not migrated.
 */
const CONFIG_REL = ".continue/config.yaml";
const RULES_REL = ".continue/rules";
const SKILLS_REL = ".continue/skills";
const COMMANDS_REL = ".continue/prompts";

export const CONTINUE_COMMANDS_WARNING =
  "commands: continue lists a prompt file as a slash command only when its frontmatter sets invokable: true; frontmatter copied as-is, review after import";

/** Warn (per file) about legacy v1 .prompt files, which are not migrated. */
export async function warnContinueLegacyPromptFiles(
  root: string,
  warnings: string[],
  prefix = "",
): Promise<void> {
  if (!(await isDir(root))) return;
  for (const name of (await listDir(root)).sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(root, name);
    if (await isDir(full)) {
      await warnContinueLegacyPromptFiles(full, warnings, `${prefix}${name}/`);
    } else if (name.endsWith(".prompt")) {
      warnings.push(
        `commands:${prefix}${name}: continue legacy v1 .prompt files are not migrated; convert to markdown prompts first`,
      );
    }
  }
}

const CLIENT_KEYS = ["requestOptions", "connectionTimeout"] as const;

async function readConfig(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, (t) => parseYaml(t) as unknown);
  return isRecord(data) ? data : {};
}

export function parseContinueServers(
  config: Record<string, unknown>,
  warnings: string[],
): McpServer[] {
  const list = Array.isArray(config.mcpServers) ? config.mcpServers : [];
  const servers: McpServer[] = [];
  for (const rawEntry of list) {
    if (!isRecord(rawEntry) || typeof rawEntry.name !== "string") {
      warnings.push("mcp: continue entry without a name; dropped");
      continue;
    }
    let entry: Record<string, unknown> = rawEntry;
    if (entry.type === "streamable-http") entry = { ...entry, type: "http" };
    const s = parseCommonMcpEntry(rawEntry.name, entry, warnings);
    if (!s) continue;
    for (const key of CLIENT_KEYS) {
      if (rawEntry[key] !== undefined) {
        warnings.push(`mcp:${s.name}: continue ${key} setting is client-specific; not migrated`);
      }
    }
    servers.push(s);
  }
  return servers;
}

export function renderContinueServers(
  bundle: Bundle,
  warnings: string[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const s of bundle.mcpServers) {
    const entry: Record<string, unknown> = { name: s.name };
    if (s.transport === "stdio") {
      entry.command = s.command;
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (s.cwd) entry.cwd = s.cwd;
    } else {
      entry.type = s.transport === "http" ? "streamable-http" : "sse";
      entry.url = s.url;
      if (s.headers && Object.keys(s.headers).length) {
        entry.requestOptions = { headers: s.headers };
      }
    }
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: continue has no disabled flag; server emitted as enabled`);
    }
    out.push(entry);
  }
  return out;
}

/** Merge imported entries into the existing name-keyed list. */
export function mergeContinueServers(
  existing: unknown,
  imported: Record<string, unknown>[],
  warnings: string[],
  replace: boolean,
): Record<string, unknown>[] {
  const existingList = (Array.isArray(existing) ? existing : []).filter(isRecord);
  if (replace) {
    const importedNames = new Set(imported.map((e) => e.name));
    for (const e of existingList) {
      if (typeof e.name === "string" && !importedNames.has(e.name)) {
        warnings.push(`mcp:${e.name}: removed by --replace-mcp`);
      }
    }
    return imported;
  }
  const out = [...existingList];
  for (const entry of imported) {
    const idx = out.findIndex((e) => e.name === entry.name);
    if (idx >= 0) {
      if (JSON.stringify(out[idx]) !== JSON.stringify(entry)) {
        warnings.push(`mcp:${String(entry.name)}: existing server with the same name overwritten by import`);
      }
      out[idx] = entry;
    } else {
      out.push(entry);
    }
  }
  return out;
}

export async function readRulesDir(
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
    warnings.push(`instructions: continue ${scope} rules files merged into one document`);
  }
  return parts.length ? parts.join("\n\n") + "\n" : undefined;
}

const continueAdapter: ClientAdapter = {
  id: "continue",
  label: "Continue",
  defaultPath: "~/.continue (config.yaml + rules/ + skills/ + prompts/)",
  supportsCommands: true,

  async detect(home) {
    return await isDir(path.join(home, ".continue"));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "continue";

    const config = await readConfig(path.join(home, CONFIG_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseContinueServers(config, warnings);
    bundle.instructions = await readRulesDir(path.join(home, RULES_REL), warnings, "global");
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(home, COMMANDS_REL), ".md");
    await warnContinueLegacyPromptFiles(path.join(home, COMMANDS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const configFile = path.join(home, CONFIG_REL);
    const hadConfig = (await readText(configFile)) !== undefined;
    const config = await readConfig(configFile);
    if (!hadConfig) {
      config.name = config.name ?? "Local Config";
      config.version = config.version ?? "1.0.0";
      config.schema = config.schema ?? "v1";
    }
    config.mcpServers = mergeContinueServers(
      config.mcpServers,
      renderContinueServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      if (hadConfig) {
        warnings.push("config: YAML comments in ~/.continue/config.yaml are not preserved on rewrite");
      }
      files.push({ path: CONFIG_REL, content: stringifyYaml(config) });
    }

    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: continue has no persona file; appended to ~/.continue/rules/agentmove.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({
        path: `${RULES_REL}/agentmove.md`,
        content: appendSections(bundle.instructions, sections),
      });
    }
    if (bundle.memory.length) {
      warnings.push("memory: continue has no durable memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, COMMANDS_REL, ".md"));
      warnings.push(CONTINUE_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

export { continueAdapter };
