import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  asStringRecord,
  Bundle,
  ClientAdapter,
  CommandDef,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  MemoryEntry,
  parseFile,
  stringArgs,
} from "../model.js";
import { exists, isDir, listDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

/**
 * goose (Block). MCP servers are "extensions" in ~/.config/goose/config.yaml
 * (stdio uses `cmd`/`args`/`envs`, remote uses `streamable_http`/`sse` with
 * `uri`); global instructions are ~/.config/goose/.goosehints; the memory
 * extension stores durable memories as <category>.txt files under
 * ~/.config/goose/memory/; skills follow the ~/.agents/skills standard.
 */
const CONFIG_REL = ".config/goose/config.yaml";
const HINTS_REL = ".config/goose/.goosehints";
const MEMORY_REL = ".config/goose/memory";
const RECIPES_REL = ".config/goose/recipes";
const SKILLS_REL = ".agents/skills";
const DEFAULT_TIMEOUT = 300;

const RECIPE_FIELDS = ["version", "title", "description", "prompt", "instructions"];

export const GOOSE_COMMANDS_EXPORT_WARNING =
  "commands: converted from goose recipe YAML/JSON (title/description + prompt/instructions); {{ param }} placeholders are goose-specific and copied as-is";

export const GOOSE_COMMANDS_IMPORT_WARNING =
  "commands: goose commands are recipe files; markdown bodies were converted to the recipe prompt field ({{ param }} placeholders copied as-is; slash commands take at most one parameter and must not clash with built-in commands; review after import)";

function frontmatterLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

/** Convert one goose recipe file (YAML or JSON) into a portable markdown command. */
export function gooseCommandFromRecipe(
  name: string,
  raw: string,
  file: string,
  warnings: string[],
): CommandDef | undefined {
  let data: unknown;
  try {
    data = file.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
  } catch {
    warnings.push(`commands:${file}: invalid recipe file; not migrated`);
    return undefined;
  }
  if (!isRecord(data)) {
    warnings.push(`commands:${file}: not a recipe mapping; not migrated`);
    return undefined;
  }
  for (const key of Object.keys(data)) {
    if (!RECIPE_FIELDS.includes(key)) {
      warnings.push(
        `commands:${name}: goose recipe field "${key}" has no portable command equivalent; dropped`,
      );
    }
  }
  const prompt = typeof data.prompt === "string" ? data.prompt : undefined;
  const instructions = typeof data.instructions === "string" ? data.instructions : undefined;
  if (prompt === undefined && instructions === undefined) {
    warnings.push(`commands:${file}: recipe has neither prompt nor instructions; not migrated`);
    return undefined;
  }
  let body: string;
  if (prompt !== undefined && instructions !== undefined) {
    body = `${instructions.trimEnd()}\n\n${prompt}`;
    warnings.push(
      `commands:${name}: recipe has both instructions and prompt; concatenated into one command body`,
    );
  } else {
    body = prompt ?? instructions ?? "";
  }
  if (!body.endsWith("\n")) body += "\n";
  const fm: string[] = [];
  const title = typeof data.title === "string" ? data.title : undefined;
  if (title !== undefined && title !== name) fm.push(frontmatterLine("title", title));
  if (typeof data.description === "string") {
    fm.push(frontmatterLine("description", data.description));
  }
  const content = fm.length ? `---\n${fm.join("\n")}\n---\n${body}` : body;
  return { name, content };
}

function parseFrontmatterString(line: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*(.+)$`).exec(line);
  if (!m?.[1]) return undefined;
  let value = m[1].trim();
  if (value.startsWith('"')) {
    try {
      value = JSON.parse(value) as string;
    } catch {
      value = value.replace(/^"|"$/g, "");
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }
  return value;
}

/** Convert a portable markdown command into goose recipe YAML content. */
export function gooseCommandToRecipe(c: CommandDef, flatName: string, warnings: string[]): string {
  let title: string | undefined;
  let description: string | undefined;
  let prompt = c.content;
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(c.content);
  if (m) {
    const lines = (m[1] ?? "").split("\n").filter((l) => l.trim() !== "");
    const parsed = lines.map((l) => ({
      title: parseFrontmatterString(l, "title"),
      description: parseFrontmatterString(l, "description"),
    }));
    if (parsed.every((p) => p.title !== undefined || p.description !== undefined)) {
      title = parsed.find((p) => p.title !== undefined)?.title;
      description = parsed.find((p) => p.description !== undefined)?.description;
      prompt = c.content.slice(m[0].length);
    } else {
      warnings.push(
        `commands:${c.name}: frontmatter has fields beyond title/description, which goose recipes cannot express; kept verbatim inside prompt`,
      );
    }
  }
  const record: Record<string, string> = {
    version: "1.0.0",
    title: title ?? flatName,
    description: description ?? `Imported by agentmove from command ${c.name}`,
    prompt,
  };
  return stringifyYaml(record);
}

/** Read every top-level recipe file under a goose recipes root (flat scan, like goose). */
export async function readGooseRecipes(root: string, warnings: string[]): Promise<CommandDef[]> {
  const commands: CommandDef[] = [];
  if (!(await isDir(root))) return commands;
  for (const name of (await listDir(root)).sort()) {
    if (await isDir(path.join(root, name))) continue;
    if (name.endsWith(".yml")) {
      warnings.push(`commands:${name}: .yml recipes are not supported by the goose CLI; not migrated`);
      continue;
    }
    if (!name.endsWith(".yaml") && !name.endsWith(".json")) continue;
    const raw = await readText(path.join(root, name));
    if (raw === undefined) continue;
    const stem = name.replace(/\.(yaml|json)$/, "");
    const cmd = gooseCommandFromRecipe(stem, raw, name, warnings);
    if (cmd) commands.push(cmd);
  }
  return commands;
}

/** Plan goose recipe writes into a flat recipes root (nested names flattened). */
export function planGooseRecipes(
  commands: CommandDef[],
  rootRel: string,
  warnings: string[],
): { plans: FilePlan[]; names: string[] } {
  const plans: FilePlan[] = [];
  const names: string[] = [];
  const used = new Set<string>();
  for (const c of commands) {
    let name = c.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(
        `commands:${c.name}: goose only discovers top-level recipe files; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`commands:${c.name}: name collides with another command after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({ path: `${rootRel}/${name}.yaml`, content: gooseCommandToRecipe(c, name, warnings) });
    names.push(name);
  }
  return { plans, names };
}

interface SlashCommandEntry {
  command: string;
  recipe_path: string;
}

/** Merge slash-command registrations into config.yaml's slash_commands list (case-insensitive by command). */
export function mergeGooseSlashCommands(
  existing: unknown,
  incoming: SlashCommandEntry[],
  warnings: string[],
): SlashCommandEntry[] {
  const out: SlashCommandEntry[] = [];
  const incomingByLower = new Map(incoming.map((e) => [e.command.toLowerCase(), e]));
  if (Array.isArray(existing)) {
    for (const entry of existing) {
      if (!isRecord(entry) || typeof entry.command !== "string") continue;
      const replacement = incomingByLower.get(entry.command.toLowerCase());
      if (replacement) {
        if (typeof entry.recipe_path === "string" && entry.recipe_path !== replacement.recipe_path) {
          warnings.push(
            `commands:${replacement.command}: existing slash command re-pointed to the imported recipe`,
          );
        }
        continue;
      }
      out.push({
        command: entry.command,
        recipe_path: typeof entry.recipe_path === "string" ? entry.recipe_path : "",
      });
    }
  }
  out.push(...incoming);
  return out;
}

const NON_MCP_TYPES = ["builtin", "platform", "frontend", "inline_python"];

async function readConfig(home: string): Promise<Record<string, unknown>> {
  const file = path.join(home, CONFIG_REL);
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, parseYaml);
  return isRecord(data) ? data : {};
}

export function fromGooseExtension(
  name: string,
  entry: unknown,
  warnings: string[],
): McpServer | undefined {
  if (!isRecord(entry)) {
    warnings.push(`mcp:${name}: entry is not an object; dropped`);
    return undefined;
  }
  const type = typeof entry.type === "string" ? entry.type : "stdio";
  if (NON_MCP_TYPES.includes(type)) return undefined;
  if (Array.isArray(entry.available_tools) && entry.available_tools.length) {
    warnings.push(`mcp:${name}: goose available_tools filter has no portable equivalent; dropped`);
  }
  if (Array.isArray(entry.env_keys) && entry.env_keys.length) {
    warnings.push(`mcp:${name}: goose env_keys reference keyring secrets; not exported`);
  }
  if (typeof entry.timeout === "number" && entry.timeout !== DEFAULT_TIMEOUT) {
    warnings.push(`mcp:${name}: goose per-extension timeout has no portable equivalent; dropped`);
  }
  const enabled = entry.enabled === false ? false : undefined;
  if (type === "stdio") {
    const command = typeof entry.cmd === "string" ? entry.cmd : undefined;
    if (!command) {
      warnings.push(`mcp:${name}: stdio extension without a cmd; dropped`);
      return undefined;
    }
    return {
      name,
      transport: "stdio",
      command,
      args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
      env: asStringRecord(entry.envs, `mcp:${name}.envs`, warnings),
      enabled,
    };
  }
  const url = typeof entry.uri === "string" ? entry.uri : undefined;
  if (!url) {
    warnings.push(`mcp:${name}: remote extension without a uri; dropped`);
    return undefined;
  }
  return {
    name,
    transport: type === "sse" ? "sse" : "http",
    url,
    headers: asStringRecord(entry.headers, `mcp:${name}.headers`, warnings),
    enabled,
  };
}

export function toGooseExtension(s: McpServer, warnings: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { name: s.name, enabled: s.enabled !== false, timeout: DEFAULT_TIMEOUT };
  if (s.transport === "stdio") {
    out.type = "stdio";
    out.cmd = s.command ?? "";
    out.args = s.args ?? [];
    if (s.env) out.envs = s.env;
    if (s.cwd) warnings.push(`mcp:${s.name}: goose does not support cwd; dropped`);
  } else {
    out.type = s.transport === "sse" ? "sse" : "streamable_http";
    if (s.url) out.uri = s.url;
    if (s.headers) out.headers = s.headers;
  }
  return out;
}

export function parseGooseMemoryFile(content: string, source: string): MemoryEntry[] {
  return content
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((l) => !l.startsWith("# "))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .map((entryContent) => ({ content: entryContent, source, kind: "long-term" as const }));
}

export const goose: ClientAdapter = {
  id: "goose",
  label: "goose",
  defaultPath: "~/.config/goose (config.yaml + .goosehints + memory/ + recipes/)",
  supportsCommands: true,

  async detect(home) {
    return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, ".config/goose")));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "goose";

    const config = await readConfig(home);
    bundle.config.raw = config;
    const extensions = isRecord(config.extensions) ? config.extensions : {};
    const servers: McpServer[] = [];
    for (const [name, entry] of Object.entries(extensions)) {
      const s = fromGooseExtension(name, entry, warnings);
      if (s) servers.push(s);
    }
    bundle.mcpServers = servers;

    bundle.instructions = await readText(path.join(home, HINTS_REL));

    const memoryDir = path.join(home, MEMORY_REL);
    if (await isDir(memoryDir)) {
      for (const file of (await listDir(memoryDir)).sort()) {
        if (!file.endsWith(".txt")) continue;
        const content = await readText(path.join(memoryDir, file));
        if (content) bundle.memory.push(...parseGooseMemoryFile(content, `goose-memory/${file}`));
      }
    }
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    bundle.commands = await readGooseRecipes(path.join(home, RECIPES_REL), warnings);
    if (bundle.commands.length) warnings.push(GOOSE_COMMANDS_EXPORT_WARNING);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readConfig(home);
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) rendered[s.name] = toGooseExtension(s, warnings);
    const existing = isRecord(config.extensions) ? config.extensions : {};
    config.extensions = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);

    let recipeNames: string[] = [];
    if (bundle.commands.length) {
      const { plans, names } = planGooseRecipes(bundle.commands, RECIPES_REL, warnings);
      files.push(...plans);
      recipeNames = names;
      config.slash_commands = mergeGooseSlashCommands(
        config.slash_commands,
        names.map((name) => ({
          command: name,
          recipe_path: `${home.replace(/\\/g, "/")}/${RECIPES_REL}/${name}.yaml`,
        })),
        warnings,
      );
      warnings.push(GOOSE_COMMANDS_IMPORT_WARNING);
    }
    if (
      touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false, recipeNames.length > 0)
    ) {
      files.push({ path: CONFIG_REL, content: stringifyYaml(config) });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: goose has no persona file; appended to ~/.config/goose/.goosehints (approximated)");
    }
    if (parts.length) files.push({ path: HINTS_REL, content: parts.join("\n\n") + "\n" });

    if (bundle.memory.length) {
      files.push({
        path: `${MEMORY_REL}/imported.txt`,
        content: bundle.memory.map((e) => e.content.trim()).join("\n\n") + "\n",
      });
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
