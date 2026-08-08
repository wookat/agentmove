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
  planSkills,
  readAgentsDir,
  readSkillsDir,
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
 * placeholders and is preserved untouched on merge. Personal Agent Skills
 * are read from ~/.agents/skills (the shared cross-agent root VS Code scans
 * natively, alongside ~/.copilot/skills and ~/.claude/skills which belong to
 * their own clients here).
 *
 * User-profile Copilot prompt files (slash commands) are flat *.prompt.md
 * files in the default profile's User/prompts folder (the same folder holds
 * other customization types like *.agent.md, which stay with their own
 * layers); workspace prompt files live in .github/prompts/, handled by the
 * project adapter. The folder is synced by Settings Sync.
 */
const SKILLS_REL = ".agents/skills";

const CANDIDATE_RELS = [
  ".config/Code/User/mcp.json",
  "Library/Application Support/Code/User/mcp.json",
  "AppData/Roaming/Code/User/mcp.json",
];

export const VSCODE_PROMPT_EXT = ".prompt.md";

export const VSCODE_COMMANDS_WARNING =
  "commands: frontmatter fields (description/name/argument-hint/agent/model/tools) are client-specific and copied as-is; review after import";

function promptsRelFor(mcpRel: string): string {
  return mcpRel.replace(/mcp\.json$/, "prompts");
}

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

async function findPromptsRel(home: string): Promise<string | undefined> {
  for (const rel of CANDIDATE_RELS.map(promptsRelFor)) {
    if (await exists(path.join(home, rel))) return rel;
  }
  return undefined;
}

/** Plan flat <name>.prompt.md writes, flattening nested bundle names. */
export function planVscodePrompts(
  commands: { name: string; content: string }[],
  rootRel: string,
  warnings: string[],
): { path: string; content: string }[] {
  const plans: { path: string; content: string }[] = [];
  const used = new Set<string>();
  for (const c of commands) {
    let name = c.name;
    if (name.includes("/")) {
      name = name.replace(/\//g, "-");
      warnings.push(
        `commands:${c.name}: vscode only discovers top-level prompt files; imported as ${name}`,
      );
    }
    if (used.has(name)) {
      warnings.push(`commands:${c.name}: name collides with another command after flattening; skipped`);
      continue;
    }
    used.add(name);
    plans.push({ path: `${rootRel}/${name}${VSCODE_PROMPT_EXT}`, content: c.content });
  }
  return plans;
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
  defaultPath:
    "~/.config/Code/User (mcp.json + prompts/, or the macOS/Windows profile folder) + ~/.agents/skills/",
  supportsCommands: true,

  async detect(home) {
    return (await findConfigRel(home)) !== undefined || (await findPromptsRel(home)) !== undefined;
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
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    const promptsRel = await findPromptsRel(home);
    if (promptsRel) {
      bundle.commands = await readAgentsDir(path.join(home, promptsRel), VSCODE_PROMPT_EXT);
    }
    warnings.push(
      "vscode instructions/chat modes are profile- or repo-scoped; user MCP servers, skills, and default-profile prompt files migrate (use --project for .vscode/mcp.json + .github/prompts/)",
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
    if (bundle.skills.length) {
      warnings.push(
        "skills: written to ~/.agents/skills, a shared root also read by other agents (codex, zed, warp-cli, …)",
      );
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    if (bundle.commands.length) {
      const promptsRel =
        (await findPromptsRel(home)) ??
        promptsRelFor((await findConfigRel(home)) ?? platformDefaultRel());
      files.push(...planVscodePrompts(bundle.commands, promptsRel, warnings));
      warnings.push(VSCODE_COMMANDS_WARNING);
      warnings.push(
        "commands: written to the default VS Code profile's User/prompts folder, which Settings Sync also manages",
      );
    }
    return { files, warnings };
  },
};
