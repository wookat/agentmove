import path from "node:path";
import JSON5 from "json5";
import {
  Bundle,
  ClientId,
  CliError,
  emptyBundle,
  EXIT_USAGE,
  ExportResult,
  FilePlan,
  ImportOptions,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
} from "./model.js";
import { isDir, listDir, readText } from "./fsutil.js";
import {
  appendSections,
  mergeAgentLists,
  mergeMcpRecords,
  parseCommonMcpEntry,
  planAgents,
  planCommandsFlat,
  planSkills,
  readAgentsDir,
  readAgentsDirRecursive,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./adapters/shared.js";
import { fromOpencodeEntry, toOpencodeEntry } from "./adapters/opencode.js";
import {
  GOOSE_COMMANDS_EXPORT_WARNING,
  parseGooseMemoryFile,
  planGooseRecipes,
  readGooseRecipes,
} from "./adapters/goose.js";
import {
  GEMINI_COMMANDS_EXPORT_WARNING,
  GEMINI_COMMANDS_IMPORT_WARNING,
  planGeminiCommands,
  readGeminiCommands,
} from "./adapters/gemini.js";
import { renderAmpEntry } from "./adapters/amp.js";
import {
  parseVscodeServers,
  planVscodePrompts,
  renderVscodeServers,
  VSCODE_COMMANDS_WARNING,
  VSCODE_PROMPT_EXT,
} from "./adapters/vscode.js";
import { parseKiroServers, renderKiroServers, warnKiroJsonAgents } from "./adapters/kiro.js";
import {
  parseRooServers,
  readRulesDir,
  renderRooServers,
  ROO_COMMANDS_WARNING,
} from "./adapters/roo.js";
import {
  CONTINUE_COMMANDS_WARNING,
  mergeContinueServers,
  parseContinueServers,
  readRulesDir as readContinueRulesDir,
  renderContinueServers,
  warnContinueLegacyPromptFiles,
} from "./adapters/continue.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { CRUSH_COMMANDS_WARNING, parseCrushServers, renderCrushServers } from "./adapters/crush.js";
import {
  DROID_COMMANDS_WARNING,
  parseDroidServers,
  renderDroidServers,
  warnDroidScriptCommands,
} from "./adapters/droid.js";
import {
  AMAZONQ_AGENTS_EXPORT_WARNING,
  AMAZONQ_AGENTS_IMPORT_WARNING,
  parseAmazonqServers,
  planAmazonqAgents,
  readAmazonqAgents,
  renderAmazonqServers,
} from "./adapters/amazonq.js";
import { parseWarpServers, renderWarpServers, warpWrapperKey } from "./adapters/warp.js";
import { parseJunieServers, renderJunieServers } from "./adapters/junie.js";
import {
  parseTraeServers,
  planTraeMcp,
  TRAE_COMMANDS_WARNING,
  warnTraeCommandDepth,
} from "./adapters/trae.js";
import { parseComateServers, planComateMcp } from "./adapters/comate.js";
import {
  CODEBUDDY_AGENTS_WARNING,
  CODEBUDDY_COMMANDS_WARNING,
  parseCodebuddyServers,
  planCodebuddyMcp,
  readCodebuddyMcp,
} from "./adapters/codebuddy.js";
import {
  parseQoderServers,
  planQoderMcp,
  QODER_AGENTS_WARNING,
  QODER_COMMANDS_WARNING,
  readQoderSettings,
} from "./adapters/qoder.js";
import {
  AUGGIE_COMMANDS_WARNING,
  parseAuggieServers,
  planAuggieMcp,
  readAuggieRulesDir,
  readAuggieSettings,
} from "./adapters/auggie.js";
import {
  KILO_AGENTS_WARNING,
  KILO_COMMANDS_WARNING,
  parseKiloServers,
  planKiloMcp,
  readKiloAgents,
  readKiloConfig,
} from "./adapters/kilo.js";
import { CLINE_COMMANDS_WARNING, warnClineNonMarkdownWorkflows } from "./adapters/cline.js";
import {
  KIMI_AGENTS_WARNING,
  parseKimiServers,
  planKimiMcp,
  readKimiMcp,
} from "./adapters/kimi.js";
import { parseCortexServers, planCortexMcp, readCortexMcp } from "./adapters/cortex.js";
import { parseGrokServers, planGrokMcp, readGrokConfig } from "./adapters/grok.js";
import { parseVibeServers, planVibeMcp, readVibeConfig } from "./adapters/vibe.js";
import {
  NANOCODER_COMMANDS_WARNING,
  parseNanocoderServers,
  planNanocoderMcp,
  readNanocoderCommandsDir,
  readNanocoderMcp,
} from "./adapters/nanocoder.js";
import { parseLibrechatServers, planLibrechatMcp, readLibrechatConfig } from "./adapters/librechat.js";
import {
  parseJetbrainsServers,
  planJetbrainsMcp,
  readJetbrainsMcp,
  readJetbrainsRulesDir,
} from "./adapters/jetbrains.js";
import {
  parseAntigravityServers,
  readAntigravityRulesDir,
  renderAntigravityServers,
} from "./adapters/antigravity.js";

/**
 * Project-scoped adapters: read/write the per-project files a client looks
 * for inside a repository (as opposed to the user-scoped files under $HOME).
 */
export interface ProjectAdapter {
  /** Whether the client has a project-scoped custom agents directory. */
  supportsAgents?: boolean;
  /** Whether the client has a project-scoped custom commands directory. */
  supportsCommands?: boolean;
  exportProject(dir: string): Promise<ExportResult>;
  planImport(bundle: Bundle, dir: string, opts?: ImportOptions): Promise<ImportResult>;
}

async function readJsonMap(file: string): Promise<Record<string, unknown>> {
  const raw = await readText(file);
  if (raw === undefined) return {};
  const data = parseFile<unknown>(file, raw, JSON.parse);
  return isRecord(data) ? data : {};
}

function parseMcpMap(obj: Record<string, unknown>, warnings: string[]): McpServer[] {
  const serversObj = isRecord(obj.mcpServers) ? obj.mcpServers : {};
  const servers: McpServer[] = [];
  for (const [name, entry] of Object.entries(serversObj)) {
    const s = parseCommonMcpEntry(name, entry, warnings);
    if (s) servers.push(s);
  }
  return servers;
}

function renderMcpMap(
  bundle: Bundle,
  withType: boolean,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of bundle.mcpServers) {
    if (s.enabled === false) {
      warnings.push(`mcp:${s.name}: no disabled flag at project scope; server emitted as enabled`);
    }
    out[s.name] = renderCommonMcpEntry(s, withType);
  }
  return out;
}

const claudeCodeProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "claude-code";
    bundle.mcpServers = parseMcpMap(await readJsonMap(path.join(dir, ".mcp.json")), warnings);
    bundle.instructions = await readText(path.join(dir, "CLAUDE.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".claude/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".claude/agents"), ".md");
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".claude/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderMcpMap(bundle, true, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) files.push({ path: "CLAUDE.md", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in claude-code; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in claude-code; skipped");
    files.push(...planSkills(bundle.skills, ".claude/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".claude/agents", ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".claude/commands", ".md"));
      warnings.push(
        "commands: argument placeholders and frontmatter fields (allowed-tools/model) are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};

const codexProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "codex";
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    warnings.push("codex has no project-scoped MCP config; MCP servers stay user-scoped (~/.codex/config.toml)");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, _opts) {
    void dir;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: codex has no project-scoped MCP config; import without --project to write ~/.codex/config.toml",
      );
    }
    if (bundle.instructions) files.push({ path: "AGENTS.md", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in codex; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in codex; skipped");
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    return { files, warnings };
  },
};

const geminiProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "gemini";
    bundle.mcpServers = parseMcpMap(
      await readJsonMap(path.join(dir, ".gemini/settings.json")),
      warnings,
    );
    bundle.instructions = await readText(path.join(dir, "GEMINI.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".gemini/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".gemini/agents"), ".md");
    bundle.commands = await readGeminiCommands(path.join(dir, ".gemini/commands"), warnings);
    if (bundle.commands.length) warnings.push(GEMINI_COMMANDS_EXPORT_WARNING);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const settings = await readJsonMap(path.join(dir, ".gemini/settings.json"));
    const existing = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    settings.mcpServers = mergeMcpRecords(
      existing,
      renderMcpMap(bundle, false, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".gemini/settings.json", content: JSON.stringify(settings, null, 2) + "\n" });
    }
    if (bundle.instructions) files.push({ path: "GEMINI.md", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in gemini; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in gemini; skipped");
    files.push(...planSkills(bundle.skills, ".gemini/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".gemini/agents", ".md"));
      warnings.push(
        'agents: gemini subagents are experimental (enabled by default; "experimental": {"enableAgents": false} disables them); ' +
          "frontmatter fields are client-specific and copied as-is",
      );
    }
    if (bundle.commands.length) {
      files.push(...planGeminiCommands(bundle.commands, ".gemini/commands", warnings));
      warnings.push(GEMINI_COMMANDS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};

const cursorProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cursor";
    bundle.mcpServers = parseMcpMap(
      await readJsonMap(path.join(dir, ".cursor/mcp.json")),
      warnings,
    );
    const rulesDir = path.join(dir, ".cursor/rules");
    if (await isDir(rulesDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(rulesDir)).sort()) {
        if (!name.endsWith(".mdc") && !name.endsWith(".md")) continue;
        const content = await readText(path.join(rulesDir, name));
        if (content) parts.push(`<!-- .cursor/rules/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("cursor rules concatenated into instructions (frontmatter kept as-is)");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".cursor/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".cursor/agents"), ".md");
    bundle.commands = await readAgentsDir(path.join(dir, ".cursor/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".cursor/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: cursor has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: cursor does not support cwd; dropped`);
      rendered[s.name] = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
    }
    config.mcpServers = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".cursor/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        "---",
        "alwaysApply: true",
        "---",
        "",
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".cursor/rules/agentmove-imported.mdc", content: body });
    }
    if (bundle.memory.length) warnings.push("memory: cursor memories are app-managed; skipped");
    files.push(...planSkills(bundle.skills, ".cursor/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".cursor/agents", ".md"));
      warnings.push(
        "agents: frontmatter fields (model/read_only/is_background) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".cursor/commands", "cursor", warnings));
      warnings.push(
        "commands: argument placeholders are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};

const windsurfProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "windsurf";
    const rulesDir = path.join(dir, ".windsurf/rules");
    if (await isDir(rulesDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(rulesDir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const content = await readText(path.join(rulesDir, name));
        if (content) parts.push(`<!-- .windsurf/rules/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("windsurf rules concatenated into instructions (frontmatter kept as-is)");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".windsurf/skills"), warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".windsurf/workflows"), ".md");
    warnings.push("windsurf has no project-scoped MCP config; MCP servers stay user-scoped");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, _opts) {
    void dir;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: windsurf has no project-scoped MCP config; import without --project to write ~/.codeium/windsurf/mcp_config.json",
      );
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".windsurf/rules/agentmove-imported.md", content: body });
    }
    if (bundle.memory.length) warnings.push("memory: windsurf memories are app-managed; skipped");
    files.push(...planSkills(bundle.skills, ".windsurf/skills"));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".windsurf/workflows", "windsurf", warnings));
      warnings.push(
        "commands: workflow frontmatter (description/auto_execution_mode) is client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};

const clineProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cline";
    const rulesDir = path.join(dir, ".clinerules");
    if (await isDir(rulesDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(rulesDir)).sort()) {
        if (!name.endsWith(".md") && !name.endsWith(".txt")) continue;
        const content = await readText(path.join(rulesDir, name));
        if (content) parts.push(`<!-- .clinerules/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("cline workspace rules concatenated into instructions");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".cline/skills"), warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".clinerules/workflows"), ".md");
    await warnClineNonMarkdownWorkflows(path.join(dir, ".clinerules/workflows"), warnings);
    warnings.push("cline has no project-scoped MCP config; MCP servers stay user-scoped");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, _opts) {
    void dir;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: cline has no project-scoped MCP config; import without --project to write ~/.cline/data/settings/cline_mcp_settings.json",
      );
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".clinerules/agentmove-imported.md", content: body });
    }
    if (bundle.memory.length) warnings.push("memory: cline has no project-scoped memory store; skipped");
    files.push(...planSkills(bundle.skills, ".cline/skills"));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".clinerules/workflows", "cline", warnings));
      warnings.push(CLINE_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const zedProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "zed";
    const settingsFile = path.join(dir, ".zed/settings.json");
    const raw = await readText(settingsFile);
    if (raw !== undefined) {
      const data = parseFile<unknown>(settingsFile, raw, (s) => JSON5.parse(s) as unknown);
      const settings = isRecord(data) ? data : {};
      const serversObj = isRecord(settings.context_servers) ? settings.context_servers : {};
      for (const [name, entry] of Object.entries(serversObj)) {
        const s = parseCommonMcpEntry(name, entry, warnings);
        if (s) bundle.mcpServers.push(s);
      }
    }
    const rules = await readText(path.join(dir, ".rules"));
    if (rules) {
      bundle.instructions = rules;
      warnings.push(".rules exported as instructions");
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const settingsFile = path.join(dir, ".zed/settings.json");
    const raw = await readText(settingsFile);
    let settings: Record<string, unknown> = {};
    if (raw !== undefined) {
      const data = parseFile<unknown>(settingsFile, raw, (s) => JSON5.parse(s) as unknown);
      if (isRecord(data)) settings = data;
      if (/(^|\s)\/\//.test(raw) || raw.includes("/*")) {
        warnings.push("zed .zed/settings.json: existing JSONC comments are not preserved on rewrite");
      }
    }
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: zed has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: zed does not support cwd; dropped`);
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      if (typeof entry.command === "string" && entry.args === undefined) entry.args = [];
      rendered[s.name] = entry;
    }
    const existing = isRecord(settings.context_servers) ? settings.context_servers : {};
    settings.context_servers = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".zed/settings.json", content: JSON.stringify(settings, null, 2) + "\n" });
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".rules", content: body });
      if (bundle.persona) warnings.push("persona: appended to .rules (approximated)");
    }
    if (bundle.memory.length) warnings.push("memory: zed has no project-scoped memory store; skipped");
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    return { files, warnings };
  },
};

const openhandsProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "openhands";
    const microagentsDir = path.join(dir, ".openhands/microagents");
    if (await isDir(microagentsDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(microagentsDir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const content = await readText(path.join(microagentsDir, name));
        if (content) parts.push(`<!-- .openhands/microagents/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("openhands repo microagents concatenated into instructions");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".openhands/skills"), warnings);
    warnings.push("openhands has no project-scoped MCP config; MCP servers stay user-scoped");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, _opts) {
    void dir;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: openhands has no project-scoped MCP config; import without --project to write ~/.openhands/config.toml",
      );
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".openhands/microagents/agentmove-imported.md", content: body });
      if (bundle.persona) warnings.push("persona: appended to a repo microagent (approximated)");
    }
    files.push(...planSkills(bundle.skills, ".openhands/skills"));
    if (bundle.memory.length) {
      warnings.push("memory: openhands has no project-scoped memory store; skipped");
    }
    return { files, warnings };
  },
};

const copilotProject: ProjectAdapter = {
  supportsAgents: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "copilot";
    const config = await readJsonMap(path.join(dir, ".mcp.json"));
    const serversObj = isRecord(config.mcpServers) ? config.mcpServers : {};
    for (const [name, entry] of Object.entries(serversObj)) {
      const normalized = isRecord(entry) && entry.type === "local" ? { ...entry, type: "stdio" } : entry;
      const s = parseCommonMcpEntry(name, normalized, warnings);
      if (s) bundle.mcpServers.push(s);
    }
    const parts: string[] = [];
    const main = await readText(path.join(dir, ".github/copilot-instructions.md"));
    if (main?.trim()) parts.push(`<!-- .github/copilot-instructions.md -->\n${main.trim()}`);
    const instrDir = path.join(dir, ".github/instructions");
    if (await isDir(instrDir)) {
      for (const name of (await listDir(instrDir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const content = await readText(path.join(instrDir, name));
        if (content?.trim()) parts.push(`<!-- .github/instructions/${name} -->\n${content.trim()}`);
      }
    }
    if (parts.length) bundle.instructions = parts.join("\n\n") + "\n";
    bundle.skills = await readSkillsDir(path.join(dir, ".github/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".github/agents"), ".agent.md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".mcp.json"));
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      if (s.enabled === false) {
        warnings.push(`mcp:${s.name}: copilot has no disabled flag; server emitted as enabled`);
      }
      if (s.cwd) warnings.push(`mcp:${s.name}: copilot does not support cwd; dropped`);
      const entry = renderCommonMcpEntry({ ...s, cwd: undefined }, false);
      entry.type = s.transport === "stdio" ? "local" : s.transport;
      rendered[s.name] = entry;
    }
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".github/instructions/agentmove-imported.instructions.md", content: body });
      if (bundle.persona) warnings.push("persona: appended to a repo instructions file (approximated)");
    }
    if (bundle.memory.length) warnings.push("memory: copilot has no project-scoped memory store; skipped");
    files.push(...planSkills(bundle.skills, ".github/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".github/agents", ".agent.md"));
      warnings.push(
        "agents: frontmatter fields (tools/model) are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};

const opencodeProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "opencode";
    const config = await readJsonMap(path.join(dir, "opencode.json"));
    const serversObj = isRecord(config.mcp) ? config.mcp : {};
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, fromOpencodeEntry(entry), warnings);
      if (s) {
        if (isRecord(entry) && entry.enabled === false) s.enabled = false;
        bundle.mcpServers.push(s);
      }
    }
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".opencode/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".opencode/agents"), ".md");
    for (const a of await readAgentsDir(path.join(dir, ".opencode/agent"), ".md")) {
      if (!bundle.agents.some((b) => b.name === a.name)) bundle.agents.push(a);
    }
    bundle.agents.sort((a, b) => a.name.localeCompare(b.name));
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".opencode/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, "opencode.json"));
    const rendered: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      rendered[s.name] = toOpencodeEntry(s, warnings);
    }
    const existing = isRecord(config.mcp) ? config.mcp : {};
    config.mcp = mergeMcpRecords(existing, rendered, warnings, opts?.replaceMcp ?? false);
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: "opencode.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push("persona: appended to the project AGENTS.md (approximated)");
    }
    if (parts.length) files.push({ path: "AGENTS.md", content: parts.join("\n\n") + "\n" });
    files.push(...planSkills(bundle.skills, ".opencode/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".opencode/agents", ".md"));
      warnings.push(
        "agents: frontmatter fields (mode/model/permission) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".opencode/commands", ".md"));
      warnings.push(
        "commands: frontmatter fields (agent/model) and argument placeholders are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.memory.length) {
      warnings.push("memory: opencode has no project-scoped memory store; skipped");
    }
    return { files, warnings };
  },
};

const qwenProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "qwen";
    bundle.mcpServers = parseMcpMap(
      await readJsonMap(path.join(dir, ".qwen/settings.json")),
      warnings,
    );
    bundle.instructions = await readText(path.join(dir, "QWEN.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".qwen/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".qwen/agents"), ".md");
    const commandsRoot = path.join(dir, ".qwen/commands");
    bundle.commands = await readAgentsDirRecursive(commandsRoot, ".md");
    for (const t of await readAgentsDirRecursive(commandsRoot, ".toml")) {
      warnings.push(
        `commands:${t.name}: qwen TOML commands are deprecated and not migrated; convert to markdown first`,
      );
    }
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const settings = await readJsonMap(path.join(dir, ".qwen/settings.json"));
    const existing = isRecord(settings.mcpServers) ? settings.mcpServers : {};
    settings.mcpServers = mergeMcpRecords(
      existing,
      renderMcpMap(bundle, false, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".qwen/settings.json", content: JSON.stringify(settings, null, 2) + "\n" });
    }
    if (bundle.instructions) files.push({ path: "QWEN.md", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in qwen; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in qwen; skipped");
    files.push(...planSkills(bundle.skills, ".qwen/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".qwen/agents", ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/approvalMode) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".qwen/commands", ".md"));
      warnings.push(
        "commands: argument placeholders ({{args}}/!{...}/@{...}) and frontmatter are client-specific and copied as-is; review after import",
      );
    }
    return { files, warnings };
  },
};

const ampProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "amp";
    const settings = await readJsonMap(path.join(dir, ".amp/settings.json"));
    const serversObj = isRecord(settings["amp.mcpServers"])
      ? (settings["amp.mcpServers"] as Record<string, unknown>)
      : {};
    for (const [name, entry] of Object.entries(serversObj)) {
      const s = parseCommonMcpEntry(name, entry, warnings);
      if (s) bundle.mcpServers.push(s);
    }
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const settings = await readJsonMap(path.join(dir, ".amp/settings.json"));
    const imported: Record<string, unknown> = {};
    for (const s of bundle.mcpServers) {
      imported[s.name] = renderAmpEntry(s, warnings);
    }
    const existing = isRecord(settings["amp.mcpServers"])
      ? (settings["amp.mcpServers"] as Record<string, unknown>)
      : {};
    settings["amp.mcpServers"] = mergeMcpRecords(
      existing,
      imported,
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".amp/settings.json", content: JSON.stringify(settings, null, 2) + "\n" });
      warnings.push("mcp: amp workspace servers require approval in amp before first use (amp mcp approve)");
    }
    if (bundle.instructions) files.push({ path: "AGENTS.md", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in amp; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in amp; skipped");
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    return { files, warnings };
  },
};

const vscodeProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "vscode";
    const config = await readJsonMap(path.join(dir, ".vscode/mcp.json"));
    bundle.mcpServers = parseVscodeServers(config, warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".github/prompts"), VSCODE_PROMPT_EXT);
    bundle.instructions = await readText(path.join(dir, ".github/copilot-instructions.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".github/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".vscode/mcp.json"));
    const existing = isRecord(config.servers) ? config.servers : {};
    config.servers = mergeMcpRecords(
      existing,
      renderVscodeServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".vscode/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: ".github/copilot-instructions.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in vscode; skipped");
    if (bundle.memory.length) warnings.push("memory: no project-scoped memory store in vscode; skipped");
    files.push(...planSkills(bundle.skills, ".github/skills"));
    if (bundle.commands.length) {
      files.push(...planVscodePrompts(bundle.commands, ".github/prompts", warnings));
      warnings.push(VSCODE_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const gooseProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "goose";
    bundle.instructions = await readText(path.join(dir, ".goosehints"));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    const memoryDir = path.join(dir, ".goose/memory");
    if (await isDir(memoryDir)) {
      for (const file of (await listDir(memoryDir)).sort()) {
        if (!file.endsWith(".txt")) continue;
        const content = await readText(path.join(memoryDir, file));
        if (content) bundle.memory.push(...parseGooseMemoryFile(content, `goose-memory/${file}`));
      }
    }
    bundle.commands = await readGooseRecipes(path.join(dir, ".goose/recipes"), warnings);
    if (bundle.commands.length) warnings.push(GOOSE_COMMANDS_EXPORT_WARNING);
    warnings.push("mcp: goose has no project-scoped extension config; skipped");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    void dir;
    void opts;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push("mcp: goose has no project-scoped extension config; skipped (import at user scope instead)");
    }
    if (bundle.instructions) files.push({ path: ".goosehints", content: bundle.instructions });
    if (bundle.persona) warnings.push("persona: no project-scoped slot in goose; skipped");
    if (bundle.memory.length) {
      files.push({
        path: ".goose/memory/imported.txt",
        content: bundle.memory.map((e) => e.content.trim()).join("\n\n") + "\n",
      });
    }
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    if (bundle.commands.length) {
      files.push(...planGooseRecipes(bundle.commands, ".goose/recipes", warnings).plans);
      warnings.push(
        "commands: written as .goose/recipes/ recipe files (run via `goose recipe` or `/recipe`); slash-command registration lives in the user-level config.yaml and was not modified",
      );
    }
    return { files, warnings };
  },
};

const kiroProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kiro";
    const config = await readJsonMap(path.join(dir, ".kiro/settings/mcp.json"));
    bundle.mcpServers = parseKiroServers(config, warnings);
    const steeringDir = path.join(dir, ".kiro/steering");
    const parts: string[] = [];
    if (await isDir(steeringDir)) {
      for (const f of (await listDir(steeringDir)).sort()) {
        if (!f.endsWith(".md")) continue;
        const content = await readText(path.join(steeringDir, f));
        if (content?.trim()) parts.push(`<!-- steering: ${f} -->\n${content.trim()}`);
      }
      if (parts.length > 1) {
        warnings.push(
          "instructions: kiro steering files merged into one document; inclusion-mode front matter is kept verbatim but only applies in kiro",
        );
      }
    }
    if (parts.length) bundle.instructions = parts.join("\n\n") + "\n";
    bundle.skills = await readSkillsDir(path.join(dir, ".kiro/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".kiro/agents"), ".md");
    await warnKiroJsonAgents(path.join(dir, ".kiro/agents"), warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".kiro/prompts"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".kiro/settings/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderKiroServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".kiro/settings/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: ".kiro/steering/AGENTS.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in kiro; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: kiro has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".kiro/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".kiro/agents", ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/permissions) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".kiro/prompts", "kiro", warnings));
      warnings.push(
        "commands: saved prompts are invoked as @name in kiro-cli (no arguments); workspace .kiro/prompts/ prompts override global ones with the same name",
      );
    }
    return { files, warnings };
  },
};

const rooProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "roo";
    const config = await readJsonMap(path.join(dir, ".roo/mcp.json"));
    bundle.mcpServers = parseRooServers(config, warnings);
    bundle.instructions = await readRulesDir(path.join(dir, ".roo/rules"), warnings, "project");
    bundle.skills = await readSkillsDir(path.join(dir, ".roo/skills"), warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".roo/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".roo/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderRooServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".roo/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: ".roo/rules/agentmove.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in roo; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: roo has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".roo/skills"));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".roo/commands", "roo", warnings));
      warnings.push(ROO_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const continueProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "continue";
    const blocksDir = path.join(dir, ".continue/mcpServers");
    const servers = [];
    if (await isDir(blocksDir)) {
      for (const f of (await listDir(blocksDir)).sort()) {
        const file = path.join(blocksDir, f);
        const raw = await readText(file);
        if (raw === undefined) continue;
        let data: unknown;
        if (f.endsWith(".yaml") || f.endsWith(".yml")) {
          data = parseFile<unknown>(file, raw, (t) => parseYaml(t) as unknown);
          if (isRecord(data)) servers.push(...parseContinueServers(data, warnings));
        } else if (f.endsWith(".json")) {
          data = parseFile<unknown>(file, raw, JSON.parse);
          if (isRecord(data) && isRecord(data.mcpServers)) {
            for (const [name, entry] of Object.entries(data.mcpServers)) {
              const s = parseCommonMcpEntry(name, entry, warnings);
              if (s) servers.push(s);
            }
          }
        }
      }
    }
    bundle.mcpServers = servers;
    bundle.instructions = await readContinueRulesDir(
      path.join(dir, ".continue/rules"),
      warnings,
      "project",
    );
    bundle.skills = await readSkillsDir(path.join(dir, ".continue/skills"), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".continue/prompts"), ".md");
    await warnContinueLegacyPromptFiles(path.join(dir, ".continue/prompts"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    void dir;
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const rendered = renderContinueServers(bundle, warnings);
    const merged = mergeContinueServers([], rendered, warnings, opts?.replaceMcp ?? false);
    if (merged.length) {
      files.push({
        path: ".continue/mcpServers/agentmove.yaml",
        content: stringifyYaml({
          name: "agentmove imported servers",
          version: "0.0.1",
          schema: "v1",
          mcpServers: merged,
        }),
      });
    }
    if (bundle.instructions) {
      files.push({ path: ".continue/rules/agentmove.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in continue; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: continue has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".continue/skills"));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".continue/prompts", ".md"));
      warnings.push(CONTINUE_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const crushProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "crush";
    const hidden = await readJsonMap(path.join(dir, ".crush.json"));
    const plain = await readJsonMap(path.join(dir, "crush.json"));
    const config = Object.keys(hidden).length ? hidden : plain;
    bundle.mcpServers = parseCrushServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, "CRUSH.md"))) ??
      (await readText(path.join(dir, "AGENTS.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".crush/skills"), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".crush/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const hiddenRaw = await readText(path.join(dir, ".crush.json"));
    const rel = hiddenRaw !== undefined ? ".crush.json" : "crush.json";
    const config = await readJsonMap(path.join(dir, rel));
    const existing = isRecord(config.mcp) ? config.mcp : {};
    config.mcp = mergeMcpRecords(
      existing,
      renderCrushServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: rel, content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: "CRUSH.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in crush; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: crush has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".crush/skills"));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".crush/commands", ".md"));
      warnings.push(CRUSH_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const antigravityProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "antigravity";
    const config = await readJsonMap(path.join(dir, ".agents/mcp_config.json"));
    bundle.mcpServers = parseAntigravityServers(config, warnings);
    const rules = await readAntigravityRulesDir(path.join(dir, ".agents/rules"), warnings);
    bundle.instructions = rules ?? (await readText(path.join(dir, "AGENTS.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    bundle.commands = await readAgentsDir(path.join(dir, ".agents/workflows"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".agents/mcp_config.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAntigravityServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({
        path: ".agents/mcp_config.json",
        content: JSON.stringify(config, null, 2) + "\n",
      });
    }
    if (bundle.instructions) {
      files.push({ path: ".agents/rules/agentmove.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in antigravity; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: antigravity has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".agents/workflows", "antigravity", warnings));
      warnings.push(
        "commands: workflows are triggered as /name in AGY and AGY IDE; AGY CLI lists them but cannot trigger them",
      );
    }
    return { files, warnings };
  },
};

const droidProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "droid";
    const config = await readJsonMap(path.join(dir, ".factory/mcp.json"));
    bundle.mcpServers = parseDroidServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, "AGENTS.md"))) ??
      (await readText(path.join(dir, ".factory/AGENTS.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".factory/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".factory/droids"), ".md");
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".factory/commands"), ".md");
    await warnDroidScriptCommands(path.join(dir, ".factory/commands"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".factory/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderDroidServers(bundle),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".factory/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: "AGENTS.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in droid; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: droid has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".factory/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".factory/droids", ".md"));
      warnings.push(
        "agents: frontmatter fields (tools/model/reasoningEffort/mcpServers) are client-specific and copied as-is; review after import",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".factory/commands", ".md"));
      warnings.push(DROID_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const amazonqProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "amazonq";
    const config = await readJsonMap(path.join(dir, ".amazonq/mcp.json"));
    bundle.mcpServers = parseAmazonqServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AmazonQ.md"));
    bundle.commands = await readAgentsDir(path.join(dir, ".amazonq/prompts"), ".md");
    bundle.agents = await readAmazonqAgents(path.join(dir, ".amazonq/cli-agents"), warnings);
    if (bundle.agents.length) warnings.push(AMAZONQ_AGENTS_EXPORT_WARNING);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".amazonq/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderAmazonqServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".amazonq/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: "AmazonQ.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in amazonq; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: amazonq has no project-scoped memory store; skipped");
    }
    if (bundle.skills.length) {
      warnings.push("skills: amazonq has no SKILL.md mechanism; skipped");
    }
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".amazonq/prompts", "amazonq", warnings));
      warnings.push(
        "commands: saved prompts are invoked as @name in q chat; argument placeholders are client-specific and copied as-is",
      );
    }
    if (bundle.agents.length) {
      files.push(...planAmazonqAgents(bundle.agents, ".amazonq/cli-agents", warnings));
      warnings.push(AMAZONQ_AGENTS_IMPORT_WARNING);
    }
    return { files, warnings };
  },
};

const junieProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "junie";
    const config = await readJsonMap(path.join(dir, ".junie/mcp/mcp.json"));
    bundle.mcpServers = parseJunieServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, ".junie/AGENTS.md"))) ??
      (await readText(path.join(dir, "AGENTS.md"))) ??
      (await readText(path.join(dir, ".junie/guidelines.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".junie/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".junie/mcp/mcp.json"));
    const existing = isRecord(config.mcpServers) ? config.mcpServers : {};
    config.mcpServers = mergeMcpRecords(
      existing,
      renderJunieServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".junie/mcp/mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: ".junie/AGENTS.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in junie; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: junie has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".junie/skills"));
    return { files, warnings };
  },
};

const warpProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "warp";
    const config = await readJsonMap(path.join(dir, ".warp/.mcp.json"));
    bundle.mcpServers = parseWarpServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, "AGENTS.md"))) ??
      (await readText(path.join(dir, "WARP.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".warp/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const config = await readJsonMap(path.join(dir, ".warp/.mcp.json"));
    const key = warpWrapperKey(config);
    const wrapped = config[key];
    const existing = isRecord(wrapped) ? wrapped : {};
    config[key] = mergeMcpRecords(
      existing,
      renderWarpServers(bundle, warnings),
      warnings,
      opts?.replaceMcp ?? false,
    );
    if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false)) {
      files.push({ path: ".warp/.mcp.json", content: JSON.stringify(config, null, 2) + "\n" });
    }
    if (bundle.instructions) {
      files.push({ path: "AGENTS.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in warp; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: warp has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".warp/skills"));
    return { files, warnings };
  },
};

const traeProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "trae";
    const config = await readJsonMap(path.join(dir, ".trae/mcp.json"));
    bundle.mcpServers = parseTraeServers(config, warnings);
    const rulesDir = path.join(dir, ".trae/rules");
    if (await isDir(rulesDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(rulesDir)).sort()) {
        if (!name.endsWith(".md")) continue;
        const content = await readText(path.join(rulesDir, name));
        if (content) parts.push(`<!-- .trae/rules/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("trae project rules concatenated into instructions (frontmatter kept as-is)");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".trae/skills"), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".trae/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planTraeMcp(
        bundle,
        path.join(dir, ".trae/mcp.json"),
        ".trae/mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    if (bundle.mcpServers.length) {
      warnings.push("mcp: trae loads .trae/mcp.json only after the Enable Project MCP toggle is on (Settings > MCP)");
    }
    if (bundle.instructions || bundle.persona) {
      const body = [
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".trae/rules/agentmove-imported.md", content: body });
      if (bundle.persona) warnings.push("persona: appended to .trae/rules/agentmove-imported.md (approximated)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: trae memories are app-managed; skipped");
    }
    files.push(...planSkills(bundle.skills, ".trae/skills"));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".trae/commands", ".md"));
      warnings.push(TRAE_COMMANDS_WARNING);
      warnTraeCommandDepth(bundle.commands, warnings, ".trae/commands");
    }
    return { files, warnings };
  },
};

const codebuddyProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "codebuddy";
    const { config } = await readCodebuddyMcp(
      [path.join(dir, ".mcp.json"), path.join(dir, "mcp.json")],
      warnings,
    );
    bundle.mcpServers = parseCodebuddyServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, "CODEBUDDY.md"))) ??
      (await readText(path.join(dir, ".codebuddy/CODEBUDDY.md")));
    if (await isDir(path.join(dir, ".codebuddy/rules"))) {
      warnings.push(
        "instructions: .codebuddy/rules/*.md are client-specific rule files; not exported (only CODEBUDDY.md is)",
      );
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".codebuddy/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".codebuddy/agents"), ".md");
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".codebuddy/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planCodebuddyMcp(
        bundle,
        [path.join(dir, ".mcp.json"), path.join(dir, "mcp.json")],
        [".mcp.json", "mcp.json"],
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to CODEBUDDY.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "CODEBUDDY.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: codebuddy auto-memory is app-managed; skipped");
    }
    files.push(...planSkills(bundle.skills, ".codebuddy/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".codebuddy/agents", ".md"));
      warnings.push(CODEBUDDY_AGENTS_WARNING);
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".codebuddy/commands", ".md"));
      warnings.push(CODEBUDDY_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const qoderProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "qoder";
    const config = await readQoderSettings(path.join(dir, ".mcp.json"));
    bundle.mcpServers = parseQoderServers(config, warnings);
    bundle.instructions =
      (await readText(path.join(dir, "AGENTS.md"))) ??
      (await readText(path.join(dir, "AGENTS.local.md")));
    if (await isDir(path.join(dir, ".qoder/rules"))) {
      warnings.push(
        "instructions: .qoder/rules/**/*.md are client-specific rule files; not exported (only AGENTS.md is)",
      );
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".qoder/skills"), warnings);
    bundle.agents = await readAgentsDir(path.join(dir, ".qoder/agents"), ".md");
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".qoder/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planQoderMcp(
        bundle,
        path.join(dir, ".mcp.json"),
        ".mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: qoder auto-memory is app-managed; skipped");
    }
    files.push(...planSkills(bundle.skills, ".qoder/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".qoder/agents", ".md"));
      warnings.push(QODER_AGENTS_WARNING);
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".qoder/commands", ".md"));
      warnings.push(QODER_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const auggieProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "auggie";
    const config = await readAuggieSettings(path.join(dir, ".augment/settings.json"));
    bundle.mcpServers = parseAuggieServers(config, warnings);
    bundle.instructions = await readAuggieRulesDir(
      path.join(dir, ".augment/rules"),
      warnings,
      "project",
    );
    bundle.skills = await readSkillsDir(path.join(dir, ".augment/skills"), warnings);
    bundle.commands = await readAgentsDirRecursive(path.join(dir, ".augment/commands"), ".md");
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planAuggieMcp(
        bundle,
        path.join(dir, ".augment/settings.json"),
        ".augment/settings.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    if (bundle.instructions) {
      files.push({ path: ".augment/rules/agentmove.md", content: bundle.instructions });
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in auggie; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: auggie has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".augment/skills"));
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".augment/commands", ".md"));
      warnings.push(AUGGIE_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const kiloProject: ProjectAdapter = {
  supportsAgents: true,
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kilo";
    const candidates = ["kilo.json", "kilo.jsonc", ".kilo/kilo.json", ".kilo/kilo.jsonc"].map(
      (rel) => path.join(dir, rel),
    );
    const { config } = await readKiloConfig(candidates, []);
    bundle.mcpServers = parseKiloServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".kilo/skills"), warnings);
    const legacy = await readAgentsDir(path.join(dir, ".kilocode/workflows"), ".md");
    bundle.commands = mergeAgentLists(
      legacy,
      await readAgentsDir(path.join(dir, ".kilo/commands"), ".md"),
    );
    if (legacy.length) {
      warnings.push(
        "commands: legacy .kilocode/workflows/ files exported; kilo now uses .kilo/commands/ (new location wins on name conflicts)",
      );
    }
    bundle.agents = mergeAgentLists(
      await readKiloAgents(path.join(dir, ".kilocode")),
      await readKiloAgents(path.join(dir, ".kilo")),
    );
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    const candidates = ["kilo.json", "kilo.jsonc", ".kilo/kilo.json", ".kilo/kilo.jsonc"].map(
      (rel) => path.join(dir, rel),
    );
    files.push(
      ...(await planKiloMcp(
        bundle,
        candidates,
        (abs) => path.relative(dir, abs),
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: kilo has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".kilo/skills"));
    if (bundle.commands.length) {
      files.push(...planCommandsFlat(bundle.commands, ".kilo/commands", "kilo", warnings));
      warnings.push(KILO_COMMANDS_WARNING);
    }
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".kilo/agents", ".md"));
      warnings.push(KILO_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};

const kimiProject: ProjectAdapter = {
  supportsAgents: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "kimi";
    const config = await readKimiMcp(path.join(dir, ".kimi-code/mcp.json"));
    bundle.mcpServers = parseKimiServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".kimi-code/skills"), warnings);
    bundle.agents = mergeAgentLists(
      await readAgentsDirRecursive(path.join(dir, ".agents/agents"), ".md"),
      await readAgentsDirRecursive(path.join(dir, ".kimi-code/agents"), ".md"),
    );
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planKimiMcp(
        bundle,
        path.join(dir, ".kimi-code/mcp.json"),
        ".kimi-code/mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: kimi has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".kimi-code/skills"));
    if (bundle.agents.length) {
      files.push(...planAgents(bundle.agents, ".kimi-code/agents", ".md"));
      warnings.push(KIMI_AGENTS_WARNING);
    }
    return { files, warnings };
  },
};

const cortexProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "cortex";
    const config = await readCortexMcp(path.join(dir, ".cortex/mcp.json"));
    bundle.mcpServers = parseCortexServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".cortex/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planCortexMcp(
        bundle,
        path.join(dir, ".cortex/mcp.json"),
        ".cortex/mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: cortex has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".cortex/skills"));
    return { files, warnings };
  },
};

const museProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "muse";
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    const memoryDir = path.join(dir, ".agents/memory");
    const index = await readText(path.join(memoryDir, "MEMORY.md"));
    if (index) bundle.memory.push({ content: index, source: "MEMORY.md", kind: "long-term" });
    for (const f of (await listDir(memoryDir)).sort()) {
      if (!f.endsWith(".md") || f === "MEMORY.md") continue;
      const content = await readText(path.join(memoryDir, f));
      if (content) bundle.memory.push({ content, source: `memory/${f}`, kind: "long-term" });
    }
    warnings.push("mcp: muse MCP servers are user-scoped (~/.config/muse/settings.json); none at project scope");
    return { bundle, warnings };
  },
  async planImport(bundle, _dir, _opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: muse MCP servers live in ~/.config/muse/settings.json (user scope); not written at project scope",
      );
    }
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      const body = bundle.memory
        .map((m) => `## ${m.source}\n\n${m.content.trim()}`)
        .join("\n\n");
      files.push({ path: ".agents/memory/agentmove.md", content: body + "\n" });
      warnings.push(
        "memory: written to .agents/memory/agentmove.md; add an index line to .agents/memory/MEMORY.md so muse surfaces it",
      );
    }
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    return { files, warnings };
  },
};

const grokProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "grok";
    const config = await readGrokConfig(path.join(dir, ".grok/config.toml"));
    bundle.mcpServers = parseGrokServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".grok/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planGrokMcp(
        bundle,
        path.join(dir, ".grok/config.toml"),
        ".grok/config.toml",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: grok has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".grok/skills"));
    return { files, warnings };
  },
};

const vibeProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "vibe";
    const config = await readVibeConfig(path.join(dir, ".vibe/config.toml"));
    bundle.mcpServers = parseVibeServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".vibe/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planVibeMcp(
        bundle,
        path.join(dir, ".vibe/config.toml"),
        ".vibe/config.toml",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: vibe has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".vibe/skills"));
    return { files, warnings };
  },
};

const nanocoderProject: ProjectAdapter = {
  supportsCommands: true,
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "nanocoder";
    const config = await readNanocoderMcp(path.join(dir, ".mcp.json"));
    bundle.mcpServers = parseNanocoderServers(config, warnings);
    bundle.instructions = await readText(path.join(dir, "AGENTS.md"));
    bundle.commands = await readNanocoderCommandsDir(
      path.join(dir, ".nanocoder/commands"),
      warnings,
    );
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planNanocoderMcp(
        bundle,
        path.join(dir, ".mcp.json"),
        ".mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: nanocoder has no project-scoped memory store; skipped");
    }
    if (bundle.skills.length) {
      warnings.push(
        "skills: nanocoder skills use their own skill.yaml bundle format, not the Agent Skills standard; skipped",
      );
    }
    if (bundle.commands.length) {
      files.push(...planAgents(bundle.commands, ".nanocoder/commands", ".md"));
      warnings.push(NANOCODER_COMMANDS_WARNING);
    }
    return { files, warnings };
  },
};

const librechatProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "librechat";
    const config = await readLibrechatConfig(path.join(dir, "librechat.yaml"));
    bundle.mcpServers = parseLibrechatServers(config, warnings);
    warnings.push(
      "instructions: librechat custom prompts, agents, and memory are app-managed (database); only mcpServers migrate",
    );
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planLibrechatMcp(
        bundle,
        path.join(dir, "librechat.yaml"),
        "librechat.yaml",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    if (bundle.instructions) {
      warnings.push("instructions: librechat custom prompts are app-managed (database); skipped");
    }
    if (bundle.persona) warnings.push("persona: librechat has no persona file; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: librechat memory is app-managed (database); skipped (consider --mif)");
    }
    if (bundle.skills.length) {
      warnings.push("skills: librechat has no SKILL.md mechanism; skipped");
    }
    return { files, warnings };
  },
};

const jetbrainsProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "jetbrains";
    const config = await readJetbrainsMcp(path.join(dir, ".ai/mcp/mcp.json"));
    bundle.mcpServers = parseJetbrainsServers(config, warnings);
    bundle.instructions = await readJetbrainsRulesDir(
      path.join(dir, ".aiassistant/rules"),
      warnings,
    );
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planJetbrainsMcp(
        bundle,
        path.join(dir, ".ai/mcp/mcp.json"),
        ".ai/mcp/mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    if (bundle.instructions) {
      files.push({ path: ".aiassistant/rules/agentmove.md", content: bundle.instructions });
      warnings.push(
        "instructions: jetbrains rule type (Always/Manually/...) is set in the IDE; imported rule defaults to Always",
      );
    }
    if (bundle.persona) warnings.push("persona: no project-scoped slot in jetbrains; skipped");
    if (bundle.memory.length) {
      warnings.push("memory: jetbrains has no project-scoped memory store; skipped");
    }
    if (bundle.skills.length) {
      warnings.push("skills: jetbrains has no Agent Skills directory; skipped");
    }
    return { files, warnings };
  },
};

const comateProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "comate";
    const config = await readJsonMap(path.join(dir, ".comate/mcp.json"));
    bundle.mcpServers = parseComateServers(config, warnings);
    const rulesDir = path.join(dir, ".comate/rules");
    if (await isDir(rulesDir)) {
      const parts: string[] = [];
      for (const name of (await listDir(rulesDir)).sort()) {
        if (!name.endsWith(".mdr") && !name.endsWith(".md")) continue;
        const content = await readText(path.join(rulesDir, name));
        if (content) parts.push(`<!-- .comate/rules/${name} -->\n${content.trim()}`);
      }
      if (parts.length) {
        bundle.instructions = parts.join("\n\n") + "\n";
        warnings.push("comate project rules concatenated into instructions (frontmatter kept as-is)");
      }
    }
    bundle.skills = await readSkillsDir(path.join(dir, ".comate/skills"), warnings);
    return { bundle, warnings };
  },
  async planImport(bundle, dir, opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    files.push(
      ...(await planComateMcp(
        bundle,
        path.join(dir, ".comate/mcp.json"),
        ".comate/mcp.json",
        warnings,
        opts?.replaceMcp ?? false,
      )),
    );
    if (bundle.instructions || bundle.persona) {
      const body = [
        "---",
        "description:",
        "globs:",
        "alwaysApply: true",
        "---",
        "",
        ...(bundle.instructions ? [bundle.instructions.trim(), ""] : []),
        ...(bundle.persona
          ? ["## Imported by agentmove: persona (SOUL.md)", "", bundle.persona.trim(), ""]
          : []),
      ].join("\n");
      files.push({ path: ".comate/rules/agentmove-imported.mdr", content: body });
      if (bundle.persona) warnings.push("persona: appended to .comate/rules/agentmove-imported.mdr (approximated)");
    }
    if (bundle.memory.length) {
      warnings.push("memory: comate memories are app-managed under .comate; skipped");
    }
    files.push(...planSkills(bundle.skills, ".comate/skills"));
    return { files, warnings };
  },
};

const warpCliProject: ProjectAdapter = {
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "warp-cli";
    bundle.instructions =
      (await readText(path.join(dir, "AGENTS.md"))) ??
      (await readText(path.join(dir, "WARP.md")));
    bundle.skills = await readSkillsDir(path.join(dir, ".agents/skills"), warnings);
    warnings.push(
      "mcp: warp-cli MCP servers are user-scoped (~/.warp_cli/.mcp.json); project .warp/.mcp.json belongs to the warp client",
    );
    return { bundle, warnings };
  },
  async planImport(bundle, _dir, _opts) {
    const warnings: string[] = [];
    const files: FilePlan[] = [];
    if (bundle.mcpServers.length) {
      warnings.push(
        "mcp: warp-cli MCP servers live in ~/.warp_cli/.mcp.json (user scope); not written at project scope (use the warp client for .warp/.mcp.json)",
      );
    }
    const sections: { title: string; body: string }[] = [];
    if (bundle.persona) {
      sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
      warnings.push("persona: appended to AGENTS.md (approximated)");
    }
    if (bundle.instructions || sections.length) {
      files.push({ path: "AGENTS.md", content: appendSections(bundle.instructions, sections) });
    }
    if (bundle.memory.length) {
      warnings.push("memory: warp-cli has no project-scoped memory store; skipped");
    }
    files.push(...planSkills(bundle.skills, ".agents/skills"));
    return { files, warnings };
  },
};

const PROJECT_ADAPTERS: Partial<Record<ClientId, ProjectAdapter>> = {
  "claude-code": claudeCodeProject,
  codex: codexProject,
  gemini: geminiProject,
  cursor: cursorProject,
  windsurf: windsurfProject,
  cline: clineProject,
  zed: zedProject,
  openhands: openhandsProject,
  copilot: copilotProject,
  opencode: opencodeProject,
  qwen: qwenProject,
  amp: ampProject,
  vscode: vscodeProject,
  kiro: kiroProject,
  roo: rooProject,
  continue: continueProject,
  crush: crushProject,
  goose: gooseProject,
  antigravity: antigravityProject,
  droid: droidProject,
  amazonq: amazonqProject,
  warp: warpProject,
  junie: junieProject,
  jetbrains: jetbrainsProject,
  trae: traeProject,
  codebuddy: codebuddyProject,
  comate: comateProject,
  qoder: qoderProject,
  auggie: auggieProject,
  kilo: kiloProject,
  kimi: kimiProject,
  grok: grokProject,
  vibe: vibeProject,
  nanocoder: nanocoderProject,
  librechat: librechatProject,
  muse: museProject,
  "warp-cli": warpCliProject,
  cortex: cortexProject,
};

export function getProjectAdapter(id: ClientId): ProjectAdapter {
  const adapter = PROJECT_ADAPTERS[id];
  if (!adapter) {
    throw new CliError(
      `client "${id}" has no project-scoped files; --project supports: ${Object.keys(PROJECT_ADAPTERS).join(", ")}`,
      EXIT_USAGE,
    );
  }
  return adapter;
}
