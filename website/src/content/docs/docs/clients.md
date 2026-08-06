---
title: Supported clients
description: What AgentMove reads and writes for each client.
---

| Client | id | Data read / written |
| --- | --- | --- |
| OpenClaw | `openclaw` | `~/.openclaw/openclaw.json` (JSON5, `mcp.servers`, model), workspace `SOUL.md`, `AGENTS.md`, `MEMORY.md`, `USER.md`, `memory/YYYY-MM-DD.md`, `skills/` (plus `~/.openclaw/skills/`) |
| Hermes Agent | `hermes` | `~/.hermes/config.yaml` (`mcp_servers`, model), `SOUL.md`, `memories/MEMORY.md` and `USER.md` (`§`-delimited entries), `skills/` |
| Claude Code | `claude-code` | `~/.claude.json` (`mcpServers`), `~/.claude/CLAUDE.md`, `~/.claude/skills/` |
| Claude Desktop | `claude-desktop` | `claude_desktop_config.json` (`mcpServers`); located at `~/Library/Application Support/Claude` (macOS), `%APPDATA%\Claude` (Windows), or `~/.config/Claude` (Linux) — all three are checked |
| Codex CLI | `codex` | `~/.codex/config.toml` (`[mcp_servers.*]`, model), `~/.codex/AGENTS.md`, `~/.agents/skills/` |
| Cursor | `cursor` | `~/.cursor/mcp.json`; instructions/persona imported as `~/.cursor/rules/agentmove-imported.mdc` |
| Gemini CLI | `gemini` | `~/.gemini/settings.json` (`mcpServers`), `~/.gemini/GEMINI.md` (including the "Gemini Added Memories" section) |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` (`mcpServers`, remote servers use `serverUrl`), `~/.codeium/windsurf/memories/global_rules.md` |
| Cline | `cline` | `~/.cline/data/settings/cline_mcp_settings.json` (`mcpServers`, remote servers use `type: streamableHttp`/`sse` + `url`), `~/Documents/Cline/Rules/*.md` |
| Zed | `zed` | `~/.config/zed/settings.json` (`context_servers`; JSONC, stdio servers require `args`), `~/.config/zed/AGENTS.md` |
| OpenHands | `openhands` | `~/.openhands/config.toml` (`[mcp]` with `stdio_servers`/`shttp_servers`/`sse_servers`), `~/.openhands/microagents/*.md` |
| GitHub Copilot CLI | `copilot` | `~/.copilot/mcp-config.json` (`mcpServers`, stdio servers use `type: local`), `~/.copilot/copilot-instructions.md` + `~/.copilot/instructions/*.instructions.md` |
| OpenCode | `opencode` | `~/.config/opencode/opencode.json` (`mcp`; local servers use `type: local` with an argv `command` array + `environment`, remote use `type: remote`), `~/.config/opencode/AGENTS.md`, `~/.config/opencode/skills/` |
| Qwen Code | `qwen` | `~/.qwen/settings.json` (`mcpServers`; remote servers use `url` or `httpUrl`), `~/.qwen/QWEN.md` (including the "Qwen Added Memories" section), `~/.qwen/skills/` |
| Amp | `amp` | `~/.config/amp/settings.json` (`amp.mcpServers`; local servers use `command`/`args`/`env`, remote use `url`/`headers`), `~/.config/amp/AGENTS.md`, `~/.agents/skills/` |
| goose | `goose` | `~/.config/goose/config.yaml` (`extensions`; stdio uses `cmd`/`args`/`envs`, remote uses `streamable_http`/`sse` + `uri`), `~/.config/goose/.goosehints`, memory-extension files in `~/.config/goose/memory/`, `~/.agents/skills/` |

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
- **GitHub Copilot CLI** per-server `tools` allowlists are client-specific and
  reported on export; there is no disabled flag, so disabled servers are
  emitted as enabled with a warning. Skills and durable memory have no Copilot
  equivalent.
- **OpenCode** has no `sse` transport — SSE servers are emitted as `remote`
  (warned); JSONC comments in `opencode.json` are not preserved on rewrite.
- **Qwen Code** has no per-server disabled flag — disabled servers are emitted
  as enabled with a warning.
- **Claude Desktop** only exposes MCP servers as a file — instructions,
  memory, and projects are app-managed and cannot be migrated; remote servers
  are emitted with a `url` for proxy setups (warned); no `--project` scope.
- **Amp** has no per-server disabled flag and no explicit transport field for
  remote servers (plain `url`); imported workspace servers (`--project`,
  `.amp/settings.json`) require approval in amp before first use
  (`amp mcp approve`). Memory has no durable store — approximated into
  `AGENTS.md` (warned).
- **goose** builtin/platform extensions are goose-internal and not exported;
  `available_tools` filters, keyring `env_keys`, and non-default per-extension
  timeouts have no portable equivalent (warned). Extensions are user-scoped
  only — `--project` covers `.goosehints`, `.goose/memory/`, and
  `.agents/skills/`.
- OpenClaw `toolFilter` and Hermes `tools.include/exclude` MCP filters have no
  portable equivalent and are dropped with a warning.
