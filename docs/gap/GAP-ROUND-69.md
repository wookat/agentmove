# GAP ROUND-69 — Cursor Agent Skills support

Goal: competitor/ecosystem scan for the next improvement. Finding: **Cursor
now officially supports the Agent Skills standard**, making our long-standing
"cursor has no skills directory" behavior stale.

## Official evidence

- Skills docs: https://cursor.com/docs/skills
  - Skill directories, all auto-loaded:
    - `.agents/skills/` (project), `.cursor/skills/` (project)
    - `~/.agents/skills/` (user), `~/.cursor/skills/` (user)
  - Standard `SKILL.md` folders (optional `scripts/`, `references/`,
    `assets/`); nested subdirectories are walked recursively.
  - For compatibility Cursor also loads `.claude/skills/`, `.codex/skills/`,
    `~/.claude/skills/`, `~/.codex/skills/`.

## Decision

Update the `cursor` adapter (user + project scope) to migrate skills:

- User scope: export/import `~/.cursor/skills/` (Cursor-specific location so
  a later export unambiguously attributes them to cursor; `~/.agents/skills/`
  is already the codex/amp/goose shared root).
- Project scope: export/import `.cursor/skills/`.
- Remove the "cursor has no skills directory; skipped" warnings.

## Ecosystem scan (rejected/deferred this round)

- **Zencoder/Zenflow**: MCP lives in VS Code `settings.json`
  (`zencoder.mcpServers`) or JetBrains IDE settings — no standalone stable
  config file surface at user scope; deferred (same conclusion as ROUND-60).
- **Lingma / Qoder CN**: aliyun docs describe UI-managed MCP config for the
  IDE plugin; the CLI surface is the existing `qoder` adapter. No new stable
  file paths documented; deferred.
- **mcp-sync / add-mcp / mcp-doctor** (competitors): MCP-layer only; no new
  client evidence to adopt beyond what we cover.
