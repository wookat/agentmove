import path from "node:path";
import {
  Bundle,
  ClientAdapter,
  emptyBundle,
  ExportResult,
  FilePlan,
  ImportResult,
  isRecord,
} from "../model.js";
import { isDir, readText } from "../fsutil.js";
import { mergeMcpRecords, planSkills, readSkillsDir, touchesMcpConfig } from "./shared.js";
import { parseWarpServers, readJsonMap, renderWarpServers, warpWrapperKey } from "./warp.js";

/**
 * Warp Agent CLI (standalone `warp` CLI, launched 2026-08). Keeps its own MCP
 * config in ~/.warp_cli/.mcp.json (same `mcpServers` format as the Warp app,
 * but a separate server set); CLI settings live in ~/.warp_cli/settings.toml
 * (themes/statusline — client-specific, untouched). Rules and skills come
 * from the shared agent locations: global rules ~/.agents/AGENTS.md and
 * personal skills ~/.agents/skills/.
 */
const CONFIG_DIR_REL = ".warp_cli";
const MCP_REL = ".warp_cli/.mcp.json";
const AGENTS_REL = ".agents/AGENTS.md";
const SKILLS_REL = ".agents/skills";

export const warpCli: ClientAdapter = {
  id: "warp-cli",
  label: "Warp Agent CLI",
  defaultPath: "~/.warp_cli/.mcp.json + ~/.agents (AGENTS.md + skills/)",

  async detect(home) {
    return isDir(path.join(home, CONFIG_DIR_REL));
  },

  async exportBundle(home): Promise<ExportResult> {
    const warnings: string[] = [];
    const bundle: Bundle = emptyBundle();
    bundle.manifest.exportedFrom = "warp-cli";

    const config = await readJsonMap(path.join(home, MCP_REL));
    bundle.config.raw = config;
    bundle.mcpServers = parseWarpServers(config, warnings);
    bundle.instructions = await readText(path.join(home, AGENTS_REL));
    bundle.skills = await readSkillsDir(path.join(home, SKILLS_REL), warnings);
    return { bundle, warnings };
  },

  async planImport(bundle, home, opts): Promise<ImportResult> {
    const warnings: string[] = [];
    const files: FilePlan[] = [];

    const config = await readJsonMap(path.join(home, MCP_REL));
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
      files.push({ path: MCP_REL, content: JSON.stringify(config, null, 2) + "\n" });
    }

    const parts: string[] = [];
    if (bundle.instructions) parts.push(bundle.instructions.trim());
    if (bundle.persona) {
      parts.push(`## Imported by agentmove: persona (SOUL.md)\n\n${bundle.persona.trim()}`);
      warnings.push(
        "persona: warp-cli has no persona file; appended to ~/.agents/AGENTS.md (approximated)",
      );
    }
    if (parts.length) {
      files.push({ path: AGENTS_REL, content: parts.join("\n\n") + "\n" });
      warnings.push(
        "instructions: ~/.agents/AGENTS.md is a shared cross-agent location (also read by the Warp app and other agents)",
      );
    }

    if (bundle.memory.length) {
      warnings.push("memory: warp-cli has no durable memory store; skipped (consider --mif)");
    }
    files.push(...planSkills(bundle.skills, SKILLS_REL));
    return { files, warnings };
  },
};
