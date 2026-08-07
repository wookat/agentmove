import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  asStringRecord,
  Bundle,
  ClientAdapter,
  ClientId,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
  McpServer,
  parseFile,
  stringArgs,
} from "../model.js";
import { exists, isDir, readText } from "../fsutil.js";
import { appendSections, mergeMcpRecords, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";

export interface CodexStyleLayout {
  id: ClientId;
  label: string;
  defaultPath: string;
  /** Directory holding config.toml/AGENTS.md, relative to home. */
  configDir: string;
  /** Agent Skills root relative to home, or undefined when unsupported. */
  skillsRel?: string;
}

/**
 * OpenAI Codex stores config.toml + AGENTS.md in a config directory
 * (~/.codex for the standalone CLI, its own root under ~/Library for
 * Xcode's bundled Codex agent).
 */
export function makeCodexStyleAdapter(layout: CodexStyleLayout): ClientAdapter {
  const { id, configDir, skillsRel } = layout;
  const CONFIG_REL = `${configDir}/config.toml`;
  const AGENTS_REL = `${configDir}/AGENTS.md`;
  const agentsTilde = `~/${AGENTS_REL}`;

  async function readConfig(home: string): Promise<Record<string, unknown>> {
    const file = path.join(home, CONFIG_REL);
    const raw = await readText(file);
    if (raw === undefined) return {};
    const data = parseFile<unknown>(file, raw, parseToml);
    return isRecord(data) ? data : {};
  }

  return {
    id,
    label: layout.label,
    defaultPath: layout.defaultPath,

    async detect(home) {
      return (await exists(path.join(home, CONFIG_REL))) || (await isDir(path.join(home, configDir)));
    },

    async exportBundle(home): Promise<ExportResult> {
      const warnings: string[] = [];
      const bundle: Bundle = emptyBundle();
      bundle.manifest.exportedFrom = id;

      const config = await readConfig(home);
      if (typeof config.model === "string") bundle.config.model = config.model;
      bundle.config.raw = config;

      const serversObj = isRecord(config.mcp_servers) ? config.mcp_servers : {};
      const servers: McpServer[] = [];
      for (const [name, entry] of Object.entries(serversObj)) {
        if (!isRecord(entry)) {
          warnings.push(`mcp:${name}: entry is not a table; dropped`);
          continue;
        }
        const url = typeof entry.url === "string" ? entry.url : undefined;
        const command = typeof entry.command === "string" ? entry.command : undefined;
        if (!url && !command) {
          warnings.push(`mcp:${name}: neither command nor url; dropped`);
          continue;
        }
        servers.push({
          name,
          transport: url ? "http" : "stdio",
          command,
          args: stringArgs(entry.args, `mcp:${name}.args`, warnings),
          env: asStringRecord(entry.env, `mcp:${name}.env`, warnings),
          cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
          url,
          headers: asStringRecord(entry.http_headers, `mcp:${name}.http_headers`, warnings),
          enabled: typeof entry.enabled === "boolean" ? entry.enabled : undefined,
        });
      }
      bundle.mcpServers = servers;

      bundle.instructions =
        (await readText(path.join(home, `${configDir}/AGENTS.override.md`))) ??
        (await readText(path.join(home, AGENTS_REL)));
      if (skillsRel) {
        bundle.skills = await readSkillsDir(path.join(home, skillsRel), warnings);
      }
      warnings.push(`${id} memories are managed by the client and not exported in v0`);
      return { bundle, warnings };
    },

    async planImport(bundle, home, opts): Promise<ImportResult> {
      const warnings: string[] = [];
      const files: FilePlan[] = [];

      const config = await readConfig(home);
      const mcp_servers: Record<string, unknown> = {};
      for (const s of bundle.mcpServers) {
        const entry: Record<string, unknown> = {};
        if (s.transport === "stdio") {
          entry.command = s.command;
          if (s.args?.length) entry.args = s.args;
          if (s.env && Object.keys(s.env).length) entry.env = s.env;
          if (s.cwd) entry.cwd = s.cwd;
        } else {
          if (s.transport === "sse") {
            warnings.push(`mcp:${s.name}: ${id} uses streamable HTTP for remote servers; sse emitted as url`);
          }
          entry.url = s.url;
          if (s.headers && Object.keys(s.headers).length) entry.http_headers = s.headers;
        }
        if (s.enabled === false) entry.enabled = false;
        mcp_servers[s.name] = entry;
      }
      const existing = isRecord(config.mcp_servers) ? config.mcp_servers : {};
      config.mcp_servers = mergeMcpRecords(existing, mcp_servers, warnings, opts?.replaceMcp ?? false);
      if (bundle.config.model) config.model = bundle.config.model;
      if (touchesMcpConfig(bundle.mcpServers.length, opts?.replaceMcp ?? false, bundle.config.model !== undefined)) {
        files.push({ path: CONFIG_REL, content: stringifyToml(config) + "\n" });
      }

      const sections: { title: string; body: string }[] = [];
      if (bundle.persona) {
        sections.push({ title: "persona (SOUL.md)", body: bundle.persona });
        warnings.push(`persona: ${id} has no persona file; appended to ${agentsTilde} (approximated)`);
      }
      if (bundle.memory.length) {
        sections.push({
          title: "memory",
          body: bundle.memory.map((e) => `- ${e.content.trim().replace(/\n/g, "\n  ")}`).join("\n"),
        });
        warnings.push(`memory: ${id} memories cannot be written directly; appended to ${agentsTilde} (approximated)`);
      }
      const instructions = appendSections(bundle.instructions, sections);
      if (instructions) files.push({ path: AGENTS_REL, content: instructions });

      if (skillsRel) {
        files.push(...planSkills(bundle.skills, skillsRel));
      } else if (bundle.skills.length) {
        warnings.push(`skills: ${id} has no documented skills directory; skipped`);
      }
      return { files, warnings };
    },
  };
}

export const codex: ClientAdapter = makeCodexStyleAdapter({
  id: "codex",
  label: "OpenAI Codex CLI",
  defaultPath: "~/.codex (skills: ~/.agents/skills)",
  configDir: ".codex",
  skillsRel: ".agents/skills",
});
