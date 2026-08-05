---
title: Supported clients
description: What AgentMove reads and writes for each client.
---

| Client | id | Data read / written |
| --- | --- | --- |
| OpenClaw | `openclaw` | `~/.openclaw/openclaw.json` (JSON5, `mcp.servers`, model), workspace `SOUL.md`, `AGENTS.md`, `MEMORY.md`, `USER.md`, `memory/YYYY-MM-DD.md`, `skills/` (plus `~/.openclaw/skills/`) |
| Hermes Agent | `hermes` | `~/.hermes/config.yaml` (`mcp_servers`, model), `SOUL.md`, `memories/MEMORY.md` and `USER.md` (`§`-delimited entries), `skills/` |
| Claude Code | `claude-code` | `~/.claude.json` (`mcpServers`), `~/.claude/CLAUDE.md`, `~/.claude/skills/` |
| Codex CLI | `codex` | `~/.codex/config.toml` (`[mcp_servers.*]`, model), `~/.codex/AGENTS.md`, `~/.agents/skills/` |
| Cursor | `cursor` | `~/.cursor/mcp.json`; instructions/persona imported as `~/.cursor/rules/agentmove-imported.mdc` |
| Gemini CLI | `gemini` | `~/.gemini/settings.json` (`mcpServers`), `~/.gemini/GEMINI.md` (including the "Gemini Added Memories" section) |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` (`mcpServers`, remote servers use `serverUrl`), `~/.codeium/windsurf/memories/global_rules.md` |

## Known lossy edges (always reported as warnings)

- **Persona** is native only in OpenClaw/Hermes (`SOUL.md`); elsewhere it is
  appended to the instructions file and marked *approximated*.
- **Cursor** memories are app-managed and cannot be imported; skills have no
  Cursor equivalent.
- **Gemini CLI** has no `SKILL.md` mechanism; skills are skipped with a warning.
- **Codex / Claude Code** client-managed memories are not exported in v0.
- **Windsurf** Cascade memories are app-managed and cannot be migrated; skills
  have no Windsurf equivalent.
- OpenClaw `toolFilter` and Hermes `tools.include/exclude` MCP filters have no
  portable equivalent and are dropped with a warning.
