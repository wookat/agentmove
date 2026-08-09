import path from "node:path";
import JSON5 from "json5";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  AgentDef,
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
 * Continue also loads MCP block files from ~/.continue/mcpServers/ (workspace
 * scope: .continue/mcpServers/): YAML files with an `mcpServers:` list plus
 * JSON/JSONC files in every format continue's own JSON loader accepts —
 * claude-style `mcpServers` maps, claude-code style files with `projects`
 * nesting, and single-server files (name = filename). config.yaml entries win
 * duplicate names on export; imports keep writing config.yaml only. Global
 * rules are markdown files under ~/.continue/rules/.
 *
 * Prompt files (slash commands) are markdown files under ~/.continue/prompts/
 * (workspace scope: .continue/prompts/), discovered recursively; a file is
 * listed as a `/` slash command when its frontmatter sets `invokable: true`.
 * Legacy `.prompt` files use the v1 prompt-file format and are not migrated.
 */
const CONFIG_REL = ".continue/config.yaml";
const MCP_BLOCKS_REL = ".continue/mcpServers";
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

/**
 * Inline `prompts:` blocks (config.yaml or a `.continue/prompts/*.yaml` block
 * file) are unconditionally registered as slash commands by continue; export
 * each as a markdown prompt with `invokable: true` so the imported file stays
 * a slash command. Hub `uses:` references are not migrated.
 */
export function continueInlinePromptToCommand(
  entry: unknown,
  rel: string,
  warnings: string[],
): AgentDef | undefined {
  if (isRecord(entry) && typeof entry.uses === "string") {
    warnings.push(
      `commands: hub block reference (uses: ${entry.uses}) in ${rel} is not migrated; install it from the Continue hub on the target`,
    );
    return undefined;
  }
  if (!isRecord(entry) || typeof entry.name !== "string" || typeof entry.prompt !== "string") {
    warnings.push(`commands: inline prompt entry in ${rel} has no string name/prompt; skipped`);
    return undefined;
  }
  const { name, prompt, ...rest } = entry;
  const front: Record<string, unknown> = { ...rest, invokable: true };
  const body = prompt.endsWith("\n") ? prompt : `${prompt}\n`;
  return { name, content: `---\n${stringifyYaml(front)}---\n\n${body}` };
}

/** Merge inline prompts into the command list; markdown prompt files win duplicates. */
export function mergeContinueInlinePrompts(
  commands: AgentDef[],
  entries: unknown[],
  rel: string,
  warnings: string[],
): void {
  for (const entry of entries) {
    const cmd = continueInlinePromptToCommand(entry, rel, warnings);
    if (!cmd) continue;
    if (commands.some((c) => c.name === cmd.name)) {
      warnings.push(
        `commands:${cmd.name}: inline prompt in ${rel} shadowed by an existing prompt with the same name; skipped`,
      );
      continue;
    }
    warnings.push(
      `commands:${cmd.name}: defined inline in ${rel}; exported as a markdown prompt with synthesized frontmatter`,
    );
    commands.push(cmd);
  }
}

const RULE_META_KEYS = ["globs", "regex", "alwaysApply", "invokable"] as const;

/**
 * Inline `rules:` entries (a string, or an object whose `rule` text carries
 * name/globs/regex/alwaysApply/invokable metadata). Exported into the merged
 * instructions document; scoping metadata cannot be expressed there.
 */
export function continueInlineRuleToSection(
  entry: unknown,
  rel: string,
  index: number,
  warnings: string[],
): string | undefined {
  if (typeof entry === "string") {
    if (!entry.trim()) return undefined;
    warnings.push(`instructions: inline rule #${index + 1} in ${rel} merged into the instructions document`);
    return `<!-- rule: ${rel}#${index + 1} -->\n${entry.trim()}`;
  }
  if (isRecord(entry) && typeof entry.uses === "string") {
    warnings.push(
      `instructions: hub block reference (uses: ${entry.uses}) in ${rel} is not migrated; install it from the Continue hub on the target`,
    );
    return undefined;
  }
  if (!isRecord(entry) || typeof entry.rule !== "string") {
    warnings.push(`instructions: inline rule entry in ${rel} has no rule text; skipped`);
    return undefined;
  }
  const label = typeof entry.name === "string" ? entry.name : `#${index + 1}`;
  warnings.push(`instructions: inline rule ${label} in ${rel} merged into the instructions document`);
  const dropped = RULE_META_KEYS.filter((k) => entry[k] !== undefined);
  if (dropped.length) {
    warnings.push(
      `instructions:${label}: continue rule metadata (${dropped.join(", ")}) cannot be expressed in the merged instructions document; dropped`,
    );
  }
  return `<!-- rule: ${rel} ${label} -->\n${entry.rule.trim()}`;
}

/**
 * Recursively list files under a continue block directory, sorted by relative
 * path (continue walkDirs its block-type directories, skipping ignored dirs).
 */
async function listContinueBlockFiles(root: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const name of (await listDir(root)).sort()) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const full = path.join(root, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (await isDir(full)) out.push(...(await listContinueBlockFiles(full, rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * Read `.continue/<sub>/**.yaml` local block files (continue loads YAML block
 * files recursively from every block-type directory, both ~/.continue and
 * workspace .continue) and return their `prompts:`/`rules:` arrays with
 * source labels.
 */
export async function readContinueYamlBlocks(
  root: string,
  rootRel: string,
  key: "prompts" | "rules",
): Promise<{ rel: string; entries: unknown[] }[]> {
  const out: { rel: string; entries: unknown[] }[] = [];
  if (!(await isDir(root))) return out;
  for (const f of await listContinueBlockFiles(root)) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const file = path.join(root, f);
    const raw = await readText(file);
    if (raw === undefined) continue;
    const data = parseFile<unknown>(file, raw, (t) => parseYaml(t) as unknown);
    if (isRecord(data) && Array.isArray(data[key])) {
      out.push({ rel: `${rootRel}/${f}`, entries: data[key] });
    }
  }
  return out;
}

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

/** Parse one claude-style MCP entry from a JSON block file, warning on envFile. */
function parseContinueJsonEntry(
  name: string,
  entry: unknown,
  warnings: string[],
): McpServer | undefined {
  const s = parseCommonMcpEntry(name, entry, warnings);
  if (s && isRecord(entry) && entry.envFile !== undefined) {
    warnings.push(`mcp:${name}: envFile is not supported by continue; not migrated`);
  }
  return s;
}

/**
 * Parse one JSON/JSONC MCP block file the way continue's own JSON loader
 * does: claude-style `mcpServers` name-keyed maps, claude-code style files
 * with `projects` nesting, and single-server files named after the file.
 */
export function parseContinueJsonBlock(
  data: unknown,
  fileBase: string,
  rel: string,
  warnings: string[],
): McpServer[] {
  const servers: McpServer[] = [];
  if (!isRecord(data)) {
    warnings.push(`mcp: ${rel} does not match a supported MCP JSON configuration format; skipped`);
    return servers;
  }
  if (isRecord(data.mcpServers) || isRecord(data.projects)) {
    if (isRecord(data.mcpServers)) {
      for (const [name, entry] of Object.entries(data.mcpServers)) {
        const s = parseContinueJsonEntry(name, entry, warnings);
        if (s) servers.push(s);
      }
    }
    if (isRecord(data.projects)) {
      for (const project of Object.values(data.projects)) {
        if (!isRecord(project) || !isRecord(project.mcpServers)) continue;
        for (const [name, entry] of Object.entries(project.mcpServers)) {
          const s = parseContinueJsonEntry(name, entry, warnings);
          if (s) servers.push(s);
        }
      }
    }
    return servers;
  }
  if (typeof data.command === "string" || typeof data.url === "string") {
    const s = parseContinueJsonEntry(fileBase, data, warnings);
    if (s) servers.push(s);
    return servers;
  }
  warnings.push(`mcp: ${rel} does not match a supported MCP JSON configuration format; skipped`);
  return servers;
}

/**
 * Read MCP servers from local block files in a .continue/mcpServers directory:
 * YAML block files carry an `mcpServers:` list (config.yaml schema) and
 * JSON/JSONC files carry any of continue's supported JSON formats.
 */
export async function readContinueMcpBlockServers(
  root: string,
  rootRel: string,
  warnings: string[],
): Promise<McpServer[]> {
  const servers: McpServer[] = [];
  if (!(await isDir(root))) return servers;
  for (const f of await listContinueBlockFiles(root)) {
    const file = path.join(root, f);
    const raw = await readText(file);
    if (raw === undefined) continue;
    if (f.endsWith(".yaml") || f.endsWith(".yml")) {
      const data = parseFile<unknown>(file, raw, (t) => parseYaml(t) as unknown);
      if (isRecord(data)) servers.push(...parseContinueServers(data, warnings));
    } else if (f.endsWith(".json")) {
      const data = parseFile<unknown>(file, raw, (t) => JSON5.parse(t) as unknown);
      if (data === undefined) continue;
      servers.push(
        ...parseContinueJsonBlock(
          data,
          path.basename(f).replace(/\.json$/, ""),
          `${rootRel}/${f}`,
          warnings,
        ),
      );
    }
  }
  return servers;
}

/** Append servers, first-wins on duplicate names, warning for each shadowed entry. */
export function mergeContinueMcpServers(
  servers: McpServer[],
  extra: McpServer[],
  rel: string,
  warnings: string[],
): void {
  for (const s of extra) {
    if (servers.some((e) => e.name === s.name)) {
      warnings.push(
        `mcp:${s.name}: entry in ${rel} shadowed by an existing server with the same name; skipped`,
      );
      continue;
    }
    servers.push(s);
  }
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
    mergeContinueMcpServers(
      bundle.mcpServers,
      await readContinueMcpBlockServers(path.join(home, MCP_BLOCKS_REL), MCP_BLOCKS_REL, warnings),
      MCP_BLOCKS_REL,
      warnings,
    );

    const ruleSections: string[] = [];
    const rulesDoc = await readRulesDir(path.join(home, RULES_REL), warnings, "global");
    if (rulesDoc) ruleSections.push(rulesDoc.trimEnd());
    for (const block of await readContinueYamlBlocks(path.join(home, RULES_REL), RULES_REL, "rules")) {
      block.entries.forEach((entry, i) => {
        const section = continueInlineRuleToSection(entry, block.rel, i, warnings);
        if (section) ruleSections.push(section);
      });
    }
    if (Array.isArray(config.rules)) {
      config.rules.forEach((entry, i) => {
        const section = continueInlineRuleToSection(entry, CONFIG_REL, i, warnings);
        if (section) ruleSections.push(section);
      });
    }
    bundle.instructions = ruleSections.length ? ruleSections.join("\n\n") + "\n" : undefined;

    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(home, COMMANDS_REL), ".md");
    for (const block of await readContinueYamlBlocks(path.join(home, COMMANDS_REL), COMMANDS_REL, "prompts")) {
      mergeContinueInlinePrompts(bundle.commands, block.entries, block.rel, warnings);
    }
    if (Array.isArray(config.prompts)) {
      mergeContinueInlinePrompts(bundle.commands, config.prompts, CONFIG_REL, warnings);
    }
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
