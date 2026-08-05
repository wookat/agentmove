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
| Cline | `cline` | `~/.cline/data/settings/cline_mcp_settings.json` (`mcpServers`, remote servers use `type: streamableHttp`/`sse` + `url`), `~/Documents/Cline/Rules/*.md` |
| Zed | `zed` | `~/.config/zed/settings.json` (`context_servers`; JSONC, stdio servers require `args`), `~/.config/zed/AGENTS.md` |
| OpenHands | `openhands` | `~/.openhands/config.toml` (`[mcp]` with `stdio_servers`/`shttp_servers`/`sse_servers`), `~/.openhands/microagents/*.md` |

## Known lossy edges (always reported as warnings)

- **Persona** is native only in OpenClaw/Hermes (`SOUL.md`); elsewhere it is
  appended to the instructions file and marked *approximated*.
- **Cursor** memories are app-managed and cannot be imported; skills have no
  Cursor equivalent.
- **Gemini CLI** has no `SKILL.md` mechanism; skills are skipped with a warning.
- **Codex / Claude Code** client-managed memories are not exported in v0.
- **Windsurf** Cascade memories are app-managed and cannot be migrated; skills
  have no Windsurf equivalent.
- **Cline** VS Code extension keeps its own MCP settings copy in VS Code
  globalStorage; AgentMove migrates the CLI settings file (`~/.cline`) and
  global rules only. Skills have no Cline equivalent.
- **Zed** Rules Library entries and Skills are app-managed — not migrated;
  JSONC comments in `settings.json` are not preserved on rewrite (warned).
- **OpenHands** remote MCP servers only support `api_key` auth — non-Bearer
  headers are dropped with a warning; per-server `timeout` is not portable.
  Skills live in repositories (`.openhands/skills`, via `--project`).
- OpenClaw `toolFilter` and Hermes `tools.include/exclude` MCP filters have no
  portable equivalent and are dropped with a warning.
