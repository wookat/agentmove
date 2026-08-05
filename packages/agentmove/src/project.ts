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
  mergeMcpRecords,
  parseCommonMcpEntry,
  planSkills,
  readSkillsDir,
  renderCommonMcpEntry,
  touchesMcpConfig,
} from "./adapters/shared.js";

/**
 * Project-scoped adapters: read/write the per-project files a client looks
 * for inside a repository (as opposed to the user-scoped files under $HOME).
 */
export interface ProjectAdapter {
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
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "claude-code";
    bundle.mcpServers = parseMcpMap(await readJsonMap(path.join(dir, ".mcp.json")), warnings);
    bundle.instructions = await readText(path.join(dir, "CLAUDE.md"));
    bundle.skills = await readSkillsDir(path.join(dir, ".claude/skills"), warnings);
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
  async exportProject(dir) {
    const warnings: string[] = [];
    const bundle = emptyBundle();
    bundle.manifest.exportedFrom = "gemini";
    bundle.mcpServers = parseMcpMap(
      await readJsonMap(path.join(dir, ".gemini/settings.json")),
      warnings,
    );
    bundle.instructions = await readText(path.join(dir, "GEMINI.md"));
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
    if (bundle.skills.length) warnings.push("skills: gemini has no SKILL.md mechanism; skipped");
    return { files, warnings };
  },
};

const cursorProject: ProjectAdapter = {
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
    if (bundle.skills.length) warnings.push("skills: cursor has no skills directory; skipped");
    return { files, warnings };
  },
};

const windsurfProject: ProjectAdapter = {
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
    if (bundle.skills.length) warnings.push("skills: windsurf has no SKILL.md mechanism; skipped");
    return { files, warnings };
  },
};

const clineProject: ProjectAdapter = {
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
    if (bundle.skills.length) warnings.push("skills: cline has no SKILL.md mechanism; skipped");
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
    if (bundle.skills.length) warnings.push("skills: zed skills are app-managed; skipped");
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
