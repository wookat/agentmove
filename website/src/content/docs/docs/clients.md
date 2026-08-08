---
title: Supported clients
description: What AgentMove reads and writes for each client.
---

| Client | id | Data read / written |
| --- | --- | --- |
| OpenClaw | `openclaw` | `~/.openclaw/openclaw.json` (JSON5, `mcp.servers`, model), workspace `SOUL.md`, `AGENTS.md`, `MEMORY.md`, `USER.md`, `memory/YYYY-MM-DD.md`, `skills/` (plus `~/.openclaw/skills/`) |
| Hermes Agent | `hermes` | `~/.hermes/config.yaml` (`mcp_servers`, model), `SOUL.md`, `memories/MEMORY.md` and `USER.md` (`§`-delimited entries), `skills/` |
| Claude Code | `claude-code` | `~/.claude.json` (`mcpServers`), `~/.claude/CLAUDE.md`, `~/.claude/skills/`, `~/.claude/agents/` (custom subagents; project scope adds `.claude/agents/`) |
| Claude Desktop | `claude-desktop` | `claude_desktop_config.json` (`mcpServers`); located at `~/Library/Application Support/Claude` (macOS), `%APPDATA%\Claude` (Windows), or `~/.config/Claude` (Linux) — all three are checked; `~/.claude/skills/` (personal Agent Skills, loaded by Desktop local sessions, shared with Claude Code) |
| Codex CLI | `codex` | `~/.codex/config.toml` (`[mcp_servers.*]`, model; `bearer_token_env_var`/`env_http_headers` round-trip as `${VAR}` placeholder headers; `startup_timeout_sec`, `tool_timeout_sec`, `env_vars`, tool approval settings are client-specific and kept on merge), `~/.codex/AGENTS.md`, `~/.agents/skills/` |
| Cursor | `cursor` | `~/.cursor/mcp.json`, `~/.cursor/skills/` (global Agent Skills standard; project scope covers `.cursor/skills/`), `~/.cursor/agents/` (custom subagents; project scope adds `.cursor/agents/`; `model`/`read_only`/`is_background` frontmatter is client-specific); instructions/persona imported as `~/.cursor/rules/agentmove-imported.mdc` |
| Gemini CLI | `gemini` | `~/.gemini/settings.json` (`mcpServers`), `~/.gemini/GEMINI.md` (including the "Gemini Added Memories" section), `~/.gemini/skills/` (Agent Skills standard; `~/.agents/skills/` is a native alias), `~/.gemini/agents/` (experimental subagents, enabled by default); project scope adds `.gemini/skills/` + `.gemini/agents/` |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` (`mcpServers`, remote servers use `serverUrl`), `~/.codeium/windsurf/memories/global_rules.md`, `~/.codeium/windsurf/skills/` |
| Cline | `cline` | `~/.cline/data/settings/cline_mcp_settings.json` (`mcpServers`, remote servers use `type: streamableHttp`/`sse` + `url`), `~/Documents/Cline/Rules/*.md`, `~/.cline/skills/` |
| Zed | `zed` | `~/.config/zed/settings.json` (`context_servers`; JSONC, stdio servers require `args`), `~/.config/zed/AGENTS.md`, `~/.agents/skills/` |
| OpenHands | `openhands` | `~/.openhands/config.toml` (`[mcp]` with `stdio_servers`/`shttp_servers`/`sse_servers`), `~/.openhands/microagents/*.md` |
| GitHub Copilot CLI | `copilot` | `~/.copilot/mcp-config.json` (`mcpServers`, stdio servers use `type: local`), `~/.copilot/copilot-instructions.md` + `~/.copilot/instructions/*.instructions.md`, `~/.copilot/skills/`, `~/.copilot/agents/*.agent.md` (custom agents; project scope adds `.github/agents/`) |
| OpenCode | `opencode` | `~/.config/opencode/opencode.json` (`mcp`; local servers use `type: local` with an argv `command` array + `environment`, remote use `type: remote`), `~/.config/opencode/AGENTS.md`, `~/.config/opencode/skills/`, `~/.config/opencode/agents/` (custom agents; legacy `agent/` also read; project scope adds `.opencode/agents/`) |
| Qwen Code | `qwen` | `~/.qwen/settings.json` (`mcpServers`; remote servers use `url` or `httpUrl`), `~/.qwen/QWEN.md` (including the "Qwen Added Memories" section), `~/.qwen/skills/`, `~/.qwen/agents/` (custom subagents; project scope adds `.qwen/agents/`) |
| Amp | `amp` | `~/.config/amp/settings.json` (`amp.mcpServers`; local servers use `command`/`args`/`env`, remote use `url`/`headers`), `~/.config/amp/AGENTS.md`, `~/.agents/skills/` |
| VS Code | `vscode` | user-profile `mcp.json` (`servers`; stdio entries use `command`/`args`/`env`, remote use `type: http`/`sse` + `url`/`headers`); profile folder is `~/.config/Code/User` (Linux), `~/Library/Application Support/Code/User` (macOS), or `%APPDATA%\Code\User` (Windows) — all three are checked; `~/.agents/skills/` (personal Agent Skills, shared cross-agent root) |
| Kiro | `kiro` | `~/.kiro/settings/mcp.json` (`mcpServers`; stdio entries use `command`/`args`/`env` + native `disabled`, remote use `url`/`headers`), steering markdown in `~/.kiro/steering/` (AGENTS.md standard supported), `~/.kiro/skills/` (Agent Skills standard) |
| Roo Code | `roo` | VS Code globalStorage `mcp_settings.json` (`mcpServers`; stdio entries use `command`/`args`/`env` + native `disabled`, remote entries require an explicit `type: streamable-http`/`sse` + `url`/`headers`) — `~/.config/Code/User` (Linux), `~/Library/Application Support/Code/User` (macOS), or `%APPDATA%\Code\User` (Windows); rules markdown in `~/.roo/rules/`, `~/.roo/skills/` (Agent Skills standard) |
| Continue | `continue` | `~/.continue/config.yaml` (`mcpServers` **list**; each entry carries its own `name`, stdio uses `command`/`args`/`env`/`cwd`, remote uses `type: streamable-http`/`sse` + `url`), rules markdown in `~/.continue/rules/`, `~/.continue/skills/` |
| Crush | `crush` | `~/.config/crush/crush.json` (`mcp`; `type` is required — `stdio` uses `command`/`args`/`env`, `http`/`sse` use `url`/`headers` — plus a native `disabled` flag), `~/.config/crush/skills/` (Agent Skills standard); context files (CRUSH.md/AGENTS.md) are project-scoped only |
| goose | `goose` | `~/.config/goose/config.yaml` (`extensions`; stdio uses `cmd`/`args`/`envs`, remote uses `streamable_http`/`sse` + `uri`), `~/.config/goose/.goosehints`, memory-extension files in `~/.config/goose/memory/`, `~/.agents/skills/` |
| Antigravity | `antigravity` | `~/.gemini/config/mcp_config.json` (`mcpServers`; stdio uses `command`/`args`/`env`/`cwd`, remote servers require `serverUrl` — legacy `url`/`httpUrl` are not supported — plus `headers`, and a native `disabled` flag), `~/.gemini/config/skills/` (Agent Skills standard); global rules live in `~/.gemini/GEMINI.md`, shared with Gemini CLI. This shared config is used by all Antigravity 2.0 surfaces — the desktop app, the IDE, and the Antigravity CLI (`agy`) — so one migration covers all three |
| Droid | `droid` | `~/.factory/mcp.json` (`mcpServers`; `type` is `stdio`/`http`/`sse` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`, plus a native `disabled` flag), `~/.factory/AGENTS.md` (personal instructions), `~/.factory/skills/` (Agent Skills standard) |
| Amazon Q Developer CLI | `amazonq` | `~/.aws/amazonq/mcp.json` (`mcpServers`; `type` is `stdio` or `http` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`, plus a native `disabled` flag); the built-in default agent loads it via `useLegacyMcpJson` |
| Warp | `warp` | `~/.warp/.mcp.json` (`mcpServers`; entries have **no `type` field** — stdio uses `command`/`args`/`env` + optional `working_directory`, remote uses `url`/`headers` with auto-negotiated transport), `~/.warp/skills/`; global rules live in Warp Drive (app-managed) |
| Junie | `junie` | `~/.junie/mcp/mcp.json` (`mcpServers`; entries have no `type` field — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; shared by the JetBrains IDE plugin and Junie CLI), global guidelines in `~/.junie/AGENTS.md`, `~/.junie/skills/` (Agent Skills standard) |
| LM Studio | `lmstudio` | `~/.lmstudio/mcp.json` (`mcpServers`, Cursor-style notation — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; no `type` field); MCP servers only — models, presets, and chats are app-managed |
| Trae | `trae` | `~/.trae/skills/` (global Agent Skills standard); user-level MCP servers, rules, and memories are app-managed (Settings UI) — project scope is where Trae's files live: `.trae/mcp.json` (`mcpServers`; entries have no `type` field — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `.trae/rules/*.md`, and `.trae/skills/` |
| CodeBuddy | `codebuddy` | `~/.codebuddy/.mcp.json` (`mcpServers`; `type` is `stdio`/`sse`/`http` and may be omitted — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; a top-level `disabledMcpServers` name list carries the disabled state; JSONC accepted; `~/.codebuddy/mcp.json` and `~/.codebuddy.json` are read as legacy fallbacks), `~/.codebuddy/CODEBUDDY.md` (user memory file), `~/.codebuddy/skills/` (Agent Skills standard) |
| Qoder CLI | `qoder` | `~/.qoder/settings.json` (`mcpServers` key inside the general settings file — other settings are preserved on rewrite; `type` is `stdio`/`sse`/`http`/`ws` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.qoder/AGENTS.md` (user memory file), `~/.qoder/skills/` (Agent Skills standard) |
| Auggie CLI | `auggie` | `~/.augment/settings.json` (`mcpServers` key inside the general settings file — other settings are preserved on rewrite; `type` is `stdio`/`sse`/`http` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.augment/rules/*.md` (user rules, always applied), `~/.augment/skills/` (Agent Skills standard) |
| Kilo Code | `kilo` | `~/.config/kilo/kilo.json` (`mcp` key inside the general config file — other keys are preserved on rewrite; `kilo.jsonc`/`config.json` also read, JSONC accepted; local servers use `type: "local"` with `command` as an argv array plus `environment`, remote servers use `type: "remote"` + `url`/`headers`; native `enabled` flag round-trips), `~/.config/kilo/AGENTS.md` (global instructions), `~/.kilo/skills/` (Agent Skills standard; shared by the CLI and the VS Code/JetBrains extensions) |
| Kimi Code CLI | `kimi` | `~/.kimi-code/mcp.json` (`mcpServers` key; stdio uses `command`/`args`/`env`/`cwd`, HTTP uses a plain `url` with optional `headers`, legacy SSE sets `transport: "sse"`; native `enabled` flag round-trips; `bearerTokenEnvVar`/`startupTimeoutMs`/`toolTimeoutMs`/`enabledTools`/`disabledTools` are client-specific), `~/.kimi-code/AGENTS.md` (global instructions), `~/.kimi-code/skills/` (Agent Skills standard; `$KIMI_CODE_HOME` relocations are not followed) |
| Grok CLI | `grok` | `~/.grok/config.toml` (`[mcp_servers.*]` tables inside the general config file — other tables are preserved on rewrite; stdio servers use `command`/`args`/`env`, remote servers use `url`/`headers`; `startup_timeout_sec`/`tool_timeout_sec` are client-specific; `${VAR}` placeholders expand natively at load time), `~/.grok/AGENTS.md` (global rules), `~/.grok/skills/` (Agent Skills standard) |
| Vibe Code CLI | `vibe` | `~/.vibe/config.toml` (`[[mcp_servers]]` array of tables with explicit `transport` (`stdio`/`http`/`streamable-http`) inside the general config file — other keys are preserved on rewrite; stdio servers use `command`/`args`/`env`, remote servers use `url`/`headers`; `api_key_env`/`api_key_header`/`api_key_format`, `startup_timeout_sec`/`tool_timeout_sec`, and `enabled_tools`/`disabled_tools` are client-specific), `~/.vibe/AGENTS.md` (global instructions), `~/.vibe/skills/` (Agent Skills standard) |
| Nanocoder | `nanocoder` | `~/.config/nanocoder/.mcp.json` (`mcpServers` map with explicit `transport` (`stdio`/`http`/`websocket`); stdio servers use `command`/`args`/`env`, HTTP servers use `url`/`headers`; the `enabled` boolean round-trips; `timeout`/`alwaysAllow`/`description`/`tags` are client-specific); instructions live in the project-root `AGENTS.md` only (`--project`); nanocoder skills use their own `skill.yaml` bundle format and are not migrated |
| Jan | `jan` | `~/.local/share/Jan/data/mcp_config.json` (`mcpServers` map — the Jan data folder's config; every entry carries `command`/`args` (empty for remote servers), remote entries add `type` (`http`/`sse`) plus `url`/`headers`; the native `active` boolean round-trips as the enabled flag; `timeout`/`official` are client-specific; `mcpSettings` and other top-level keys are preserved on rewrite); assistants, models, and chats are app-managed |
| AnythingLLM | `anythingllm` | `~/.config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json` (`mcpServers` map; stdio uses `command`/`args`/`env`, remote uses `url`/`headers` plus optional `type` — `streamable`/`http` select Streamable HTTP and an omitted `type` means SSE; `anythingllm.autoStart: false` round-trips as the disabled flag, `anythingllm.suppressedTools` is client-specific); workspaces, system prompts, and chats are app-managed (database) |
| LibreChat | `librechat` | `librechat.yaml` in the deployment directory (project-scoped — use `--project`; `mcpServers` map: stdio servers use `command`/`args`/`env`, remote servers use `url`/`headers` with `type: sse` or `type: streamable-http` — an omitted `type` on an http(s) `url` means SSE; websocket servers are skipped; `timeout`/`initTimeout`/`serverInstructions`/`iconPath`/`chatMenu`/`customUserVars`/`requiresOAuth`/`oauth`/`proxy` are client-specific; other yaml keys are preserved on rewrite); custom prompts, agents, and memory are app-managed (database) |
| Xcode Claude Agent | `xcode-claude` | `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig/` (macOS — Xcode 26's bundled Claude Agent config root, isolated from `~/.claude`; same layout as Claude Code: `.claude.json` `mcpServers`, `.claude/CLAUDE.md` instructions, `.claude/skills/` Agent Skills) |
| Xcode Codex | `xcode-codex` | `~/Library/Developer/Xcode/CodingAssistant/codex/` (macOS — Xcode 26's bundled Codex config root, isolated from `~/.codex`; same layout as Codex CLI: `config.toml` `[mcp_servers.*]`, `AGENTS.md` instructions; no documented skills directory) |
| Xcode Gemini | `xcode-gemini` | `~/Library/Developer/Xcode/CodingAssistant/gemini/` (macOS — Xcode 26's bundled Gemini config root, isolated from `~/.gemini`; same layout as Gemini CLI: `settings.json` `mcpServers`, `GEMINI.md` instructions + "Gemini Added Memories") |
| JetBrains AI Assistant | `jetbrains` | `~/.ai/mcp/mcp.json` (`mcpServers` map shared by the JetBrains AI agents in IntelliJ-family IDEs; entries have no `type` field — stdio uses `command`/`args`/`env` plus a native `workingDirectory` that round-trips as `cwd`, remote uses `url`/`headers` over Streamable HTTP; no per-server disabled flag — servers are toggled in the IDE settings UI); project scope: `.ai/mcp/mcp.json` + `.aiassistant/rules/*.md` project rules (merged on export, imports write `.aiassistant/rules/agentmove.md`); prompts and chat memory are IDE-managed. Junie is a separate JetBrains product (see `junie`) |
| Baidu Comate | `comate` | `~/.comate/skills/` (global Agent Skills standard); MCP servers and rules are project-scoped — project scope covers `.comate/mcp.json` (`mcpServers`; entries have no `type` field — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; per-server enable/disable is toggled in the UI, not stored in the file), `.comate/rules/*.mdr` project rules (Cursor-style `description`/`globs`/`alwaysApply` frontmatter), and `.comate/skills/`; chat memory is app-managed under `.comate` |
| Warp Agent CLI | `warp-cli` | `~/.warp_cli/.mcp.json` (`mcpServers` — the CLI keeps its own server set, separate from the Warp app's `~/.warp/.mcp.json`; same entry shape: stdio `command`/`args`/`env` + `working_directory`, remote plain `url` with auto-negotiated transport, no disabled flag) + shared agent locations for context: global rules `~/.agents/AGENTS.md` and personal skills `~/.agents/skills/` (Agent Skills standard, also read by the Warp app); CLI settings (`~/.warp_cli/settings.toml` themes/statusline) are client-specific and untouched; project scope covers root `AGENTS.md` (or `WARP.md`) rules and `.agents/skills/` — project `.warp/.mcp.json` belongs to the `warp` client |
| Muse Code | `muse` | `~/.config/muse/settings.json` (`mcp_servers` map; every entry carries an explicit `transport` — `stdio` uses `command`/`args`/`env`, `streamable_http` uses `url`/`headers`; native `enabled: false` round-trips as the disabled flag; `mode` (`required`/`optional`) and `framing` are client-specific; the file must carry `"schema_version": 1`, which agentmove writes on fresh files) + `~/.config/muse/skills/` (Agent Skills standard — Muse also reads the shared `~/.agents/skills/`); project scope covers root `AGENTS.md` rules, `.agents/skills/`, and `.agents/memory/` durable Markdown memory (imports write `.agents/memory/agentmove.md`); machine-wide user rules and personal memory are app-managed |
| Cortex Code | `cortex` | `~/.snowflake/cortex/mcp.json` (`mcpServers` key with an explicit `type: stdio/http/sse` on every entry — stdio uses `command`/`args`/`env`/`cwd`, remote uses `url`/`headers`; the per-server `timeout` is client-specific; no per-server disabled flag), `~/.snowflake/cortex/AGENTS.md` (user-scope instruction file, the same file the CoCo Personalization editor writes), `~/.snowflake/cortex/skills/` (Agent Skills standard); agent-managed memory under `~/.snowflake/cortex/memory/` is not migrated; project scope covers `.cortex/mcp.json`, root `AGENTS.md`, and `.cortex/skills/` |

## Known lossy edges (always reported as warnings)

- **Persona** is native only in OpenClaw/Hermes (`SOUL.md`); elsewhere it is
  appended to the instructions file and marked *approximated*.
- **Cursor** memories are app-managed and cannot be imported; global skills
  migrate via `~/.cursor/skills/` (project skills via `.cursor/skills/` with
  `--project`).
- **Codex / Claude Code** client-managed memories are not exported in v0.
- **Codex CLI** `bearer_token_env_var` exports as an `Authorization: Bearer ${VAR}`
  placeholder header and `env_http_headers` entries export as `${VAR}` placeholder
  headers (both are written back natively on import into Codex); per-server
  `startup_timeout_sec`, `tool_timeout_sec`, `env_vars`, `enabled_tools`,
  `disabled_tools`, `default_tools_approval_mode`, `tools`, `auth`, and
  `experimental_environment` have no portable equivalent — warned on export and
  preserved on merge.
- **Windsurf** Cascade memories are app-managed and cannot be migrated; skills
  migrate natively via `~/.codeium/windsurf/skills/` (project `.windsurf/skills/`
  with `--project`).
- **Cline** VS Code extension keeps its own MCP settings copy in VS Code
  globalStorage; AgentMove migrates the CLI settings file (`~/.cline`) and
  global rules only. Skills migrate natively via `~/.cline/skills/`
  (project `.cline/skills/` with `--project`).
- **Zed** Rules Library entries are app-managed — not migrated; skills
  migrate natively via `~/.agents/skills/` (project `.agents/skills/` with
  `--project`). JSONC comments in `settings.json` are not preserved on
  rewrite (warned).
- **OpenHands** remote MCP servers only support `api_key` auth — non-Bearer
  headers are dropped with a warning; per-server `timeout` is not portable.
  Skills live in repositories (`.openhands/skills`, via `--project`).
- **GitHub Copilot CLI** per-server `tools` allowlists are client-specific and
  reported on export; there is no disabled flag, so disabled servers are
  emitted as enabled with a warning. Skills migrate natively via
  `~/.copilot/skills/` (project `.github/skills/` with `--project`); durable
  memory has no Copilot equivalent.
- **OpenCode** has no `sse` transport — SSE servers are emitted as `remote`
  (warned); JSONC comments in `opencode.json` are not preserved on rewrite.
- **Qwen Code** has no per-server disabled flag — disabled servers are emitted
  as enabled with a warning.
- **Claude Desktop** exposes MCP servers as a file and loads personal Agent
  Skills from `~/.claude/skills/` (a shared root also read by Claude Code —
  imports warn about it) — instructions, memory, and projects are app-managed
  and cannot be migrated; remote servers are emitted with a `url` for proxy
  setups (warned); no `--project` scope.
- **Amp** has no per-server disabled flag and no explicit transport field for
  remote servers (plain `url`); imported workspace servers (`--project`,
  `.amp/settings.json`) require approval in amp before first use
  (`amp mcp approve`). Memory has no durable store — approximated into
  `AGENTS.md` (warned).
- **VS Code** instructions/prompts/chat modes are profile- or repo-managed —
  user scope migrates MCP servers and personal skills (`~/.agents/skills/`, a
  shared root also read by codex/zed/warp-cli; `~/.copilot/skills` and
  `~/.claude/skills` belong to their own clients here); `--project` covers
  `.vscode/mcp.json`, `.github/copilot-instructions.md`, and `.github/skills/`;
  `inputs` prompted placeholders are
  client-specific and `${input:*}` references stay as-is (warned); `envFile`
  references are machine-specific and dropped (warned); no disabled flag.
- **Kiro** `autoApprove`, `disabledTools`, and `oauth` settings are
  client-specific and not migrated (warned); steering files are merged into one
  instructions document on export — inclusion-mode front matter is kept
  verbatim but only applies inside Kiro (warned); memory has no durable store
  and is skipped on import (warned).
- **Roo Code** `alwaysAllow`, `disabledTools`, `timeout`, and `watchPaths`
  settings are client-specific and not migrated (warned); remote servers are
  written with the explicit `type: streamable-http` Roo requires; multiple
  rules files are merged into one instructions document on export (warned);
  memory has no durable store and is skipped on import (warned).
- **Continue** `requestOptions` and `connectionTimeout` settings are
  client-specific and not migrated (warned); Continue has no disabled flag —
  disabled servers are emitted enabled (warned); skills migrate natively via
  `~/.continue/skills/` (project `.continue/skills/` with `--project`);
  memory has no durable store and is skipped on
  import (warned); YAML comments in `config.yaml` are not preserved on rewrite
  (warned). Imported remote headers are written as `requestOptions.headers`.
- **Crush** `disabled_tools` and `timeout` settings are client-specific and
  not migrated (warned); context/instructions files (CRUSH.md, AGENTS.md, …)
  are project-scoped only — user-scope imports report instructions/persona as
  skipped and `--project` writes `CRUSH.md`; memory has no durable store and is
  skipped on import (warned).
- **Antigravity** `disabledTools`, `authProviderType`, and `oauth` settings are
  client-specific and not migrated (warned); global rules live in
  `~/.gemini/GEMINI.md`, shared with Gemini CLI — the instructions layer is
  owned by the `gemini` client at user scope (`--project` writes
  `.agents/rules/agentmove.md`); memory has no durable store and is skipped on
  import (warned). Google retired the consumer tiers of Gemini CLI on
  2026-06-18 in favor of the Antigravity CLI — `agentmove convert gemini
  antigravity` migrates a Gemini CLI setup (MCP servers, GEMINI.md
  instructions and memories) into the shared Antigravity config.
- **Droid** `disabledTools`, `timeout`, `connectTimeout`, and `oauth` settings
  are client-specific and not migrated (warned); OAuth tokens live in the
  system keyring and are never exported; memory has no durable store and is
  skipped on import (warned). `--project` covers `.factory/mcp.json`,
  `AGENTS.md`, and `.factory/skills/`.
- **Amazon Q Developer CLI** `timeout`, `oauth`, and `oauthScopes` settings
  are client-specific and not migrated (warned); there is no `sse` transport
  type — imported SSE servers are written as `http` (the CLI falls back to SSE
  on handshake, warned). User-level context lives in agent JSON files
  (`cli-agents/`) and is not migrated; skills and memory are skipped (warned).
  `--project` covers `.amazonq/mcp.json` and `AmazonQ.md`.
- **Warp** entries have no `type` or `disabled` field — imported SSE servers
  are written as plain `url` entries (transport is auto-negotiated) and
  disabled servers are emitted enabled (warned). Global rules live in Warp
  Drive (app-managed) — instructions, persona, and memory are skipped at
  user level (warned). Skills migrate natively via `~/.warp/skills/`
  (project `.warp/skills/` with `--project`). `--project` covers
  `.warp/.mcp.json`, `AGENTS.md` (legacy `WARP.md` is read), and
  `.warp/skills/`.
- **Junie** has no `disabled` field in `mcp.json` (servers are toggled via the
  `/mcp` UI) — disabled servers are emitted enabled (warned); remote servers
  are plain `url` entries, so imported SSE servers are written without a
  transport type (warned). Memory has no durable store and is skipped on
  import (warned); persona is appended to `~/.junie/AGENTS.md`
  (approximated). `--project` covers `.junie/mcp/mcp.json`,
  `.junie/AGENTS.md` (root `AGENTS.md` and legacy `.junie/guidelines.md` are
  read), and `.junie/skills/`.
- **LM Studio** only exposes MCP servers as a file (`~/.lmstudio/mcp.json`) —
  system prompts/presets, chats, and models are app-managed and cannot be
  migrated; no disabled flag (disabled servers emitted enabled, warned);
  imported SSE servers are written as plain `url` entries (warned); no
  `--project` scope.
- **Trae** user-level MCP servers, global rules, and memories are app-managed
  through the Settings UI with no documented config file — only global skills
  (`~/.trae/skills/`) migrate at user scope (warned). `--project` covers
  `.trae/mcp.json` (no `type` or `disabled` fields — disabled servers emitted
  enabled and SSE written as plain `url`, both warned; Trae only loads it
  after the "Enable Project MCP" toggle is on), `.trae/rules/` (imported rules
  land in `.trae/rules/agentmove-imported.md`), and `.trae/skills/`.
- **Baidu Comate** MCP servers and rules are project-scoped only — at user
  scope just global skills (`~/.comate/skills/`) migrate (warned).
  `--project` covers `.comate/mcp.json` (no `type` or `disabled` fields —
  disabled servers emitted enabled and SSE written as plain `url`, both
  warned), `.comate/rules/*.mdr` (imported rules land in
  `.comate/rules/agentmove-imported.mdr` with an `alwaysApply: true`
  frontmatter), and `.comate/skills/`. Chat memory is app-managed under
  `.comate` and skipped (warned).
- **CodeBuddy** disabled state round-trips via the top-level
  `disabledMcpServers` name list; per-server `description` is client-specific
  (warned); `cwd` is not documented and dropped (warned); user rule files in
  `~/.codebuddy/rules/` are client-specific and left in place (warned).
  `--project` covers `.mcp.json` at the project root (the same file Claude
  Code project scope uses), `CODEBUDDY.md`, and `.codebuddy/skills/`.
- **Qoder CLI** has no per-server disabled flag (only `mcp.allowed`/`mcp.excluded`
  allowlists, preserved as plain settings) — disabled servers are emitted
  enabled (warned); `ws` (WebSocket) servers have no portable equivalent and
  are skipped on export (warned); `isProxy` is client-specific (warned); `cwd`
  is not documented and dropped (warned); user rule files in `~/.qoder/rules/`
  are client-specific and left in place (warned); auto-memory is app-managed
  and skipped on import (warned). `--project` covers `.mcp.json` at the
  project root, `AGENTS.md` (legacy `AGENTS.local.md` is read), and
  `.qoder/skills/`.
- **Auggie CLI** has no per-server disabled flag — disabled servers are
  emitted enabled (warned); `cwd` is not documented and dropped (warned);
  multiple user rules files are merged into one instructions document on
  export (warned); Augment Memories are app-managed and skipped on import
  (warned); persona is appended to `~/.augment/rules/agentmove.md`
  (approximated). `--project` covers `.augment/settings.json` (shared team
  settings — personal `.augment/settings.local.json` is machine-private and
  not migrated), `.augment/rules/`, and `.augment/skills/`.
- **Kilo Code** has no `sse` type — SSE servers are emitted as `remote`
  (warned); `cwd` is not supported and dropped (warned); per-server `timeout`
  is client-specific (warned, preserved on merge); JSONC comments are not
  preserved on rewrite (warned); memory has no durable store — skipped
  (warned). `--project` covers `kilo.json`/`.kilo/kilo.json(c)`, root
  `AGENTS.md`, and `.kilo/skills/`.
- **Kimi Code CLI** per-server `bearerTokenEnvVar`, `startupTimeoutMs`,
  `toolTimeoutMs`, `enabledTools`, and `disabledTools` are client-specific
  (warned, preserved on merge); memory has no durable store — skipped
  (warned); persona is appended to `~/.kimi-code/AGENTS.md` (approximated).
  `--project` covers `.kimi-code/mcp.json`, root `AGENTS.md`, and
  `.kimi-code/skills/`.
- **Cortex Code** per-server `timeout` is client-specific (warned, preserved on
  merge); no per-server disabled flag — disabled servers are imported as
  enabled (warned); memory under `~/.snowflake/cortex/memory/` is agent-managed
  — skipped (warned, consider `--mif`); persona is appended to
  `~/.snowflake/cortex/AGENTS.md` (approximated). `--project` covers
  `.cortex/mcp.json`, root `AGENTS.md`, and `.cortex/skills/`.
- **Grok CLI** has no documented `sse` transport — SSE servers are emitted as
  plain `url` entries (warned); `cwd` is not documented and dropped (warned);
  `config.toml` has no documented per-server disabled flag — disabled servers
  are imported as enabled (warned; use `grok mcp disable` afterwards);
  per-server `startup_timeout_sec`/`tool_timeout_sec` are client-specific
  (warned, preserved on merge); memory has no durable store — skipped
  (warned); compat-loaded servers (`~/.claude.json`, `.cursor/mcp.json`,
  `.mcp.json`) belong to those clients and are not read from Grok. `--project`
  covers `.grok/config.toml`, root `AGENTS.md`, and `.grok/skills/`.
- **Vibe Code CLI** has no `sse` transport — SSE servers are emitted as `http`
  entries (warned); `cwd` is not documented and dropped (warned); there is no
  per-server disabled flag — disabled servers are imported as enabled
  (warned); `api_key_env`/`api_key_header`/`api_key_format`,
  `startup_timeout_sec`/`tool_timeout_sec`, and `enabled_tools`/`disabled_tools`
  are client-specific (warned, preserved on merge); memory has no durable
  store — skipped (warned). `--project` covers `.vibe/config.toml`, root
  `AGENTS.md`, and `.vibe/skills/`.
- **Nanocoder** `websocket` servers have no portable equivalent and are
  skipped on export (warned); SSE servers are emitted as `http` entries
  (warned); `cwd` is not supported and dropped (warned);
  `timeout`/`alwaysAllow`/`description`/`tags` are client-specific (warned,
  preserved on merge); user-level instructions have no slot — nanocoder reads
  `AGENTS.md` from the project root only (use `--project`); skills use
  nanocoder's own `skill.yaml` bundle format, not the Agent Skills standard —
  skipped (warned); memory has no durable store — skipped (warned).
  `--project` covers `.mcp.json` and the root `AGENTS.md`.
- **Jan** entries always carry `command`/`args` keys (Jan's loader requires
  them), so remote servers are written with empty values plus `type` and
  `url`; `timeout` (seconds) and `official` are client-specific (warned,
  preserved on merge); `cwd` is not supported and dropped (warned); assistant
  instructions live in app-managed `assistants/*/assistant.json` — imported
  instructions/persona are skipped (warned); memory and skills have no slot —
  skipped (warned). The Jan data folder defaults to `~/.local/share/Jan/data`
  on Linux and can be relocated in Settings; relocated folders are not
  followed.
- **AnythingLLM** remote entries use `type: streamable` (or `http`) for
  Streamable HTTP and default to SSE when `type` is omitted — imported HTTP
  servers are written as `type: streamable`; `anythingllm.autoStart: false`
  round-trips as the disabled flag, and `anythingllm.suppressedTools` is
  client-specific (warned, preserved on merge); `cwd` is not supported and
  dropped (warned); workspaces, system prompts, and chat history live in the
  app database — imported instructions/persona/memory/skills are skipped
  (warned). The Linux desktop storage path is
  `~/.config/anythingllm-desktop/storage`; macOS/Windows and Docker
  `STORAGE_DIR` locations are not followed.
- **LibreChat** is a self-hosted deployment: everything migratable lives in
  the deployment's `librechat.yaml`, so use `--project` in the deployment
  directory (user scope is warnings-only). Remote entries are written with an
  explicit `type: sse`/`streamable-http`; websocket servers have no portable
  equivalent and are skipped (warned); there is no disabled flag and `cwd` is
  not supported (warned); `timeout`/`customUserVars`/`oauth` and other
  client-specific keys are warned and preserved on merge; existing YAML
  comments are not preserved on rewrite (warned). Custom prompts, agents, and
  memory live in the app database — imported instructions/persona/memory/
  skills are skipped (warned).
- **Xcode Claude Agent / Codex / Gemini** (`xcode-claude`/`xcode-codex`/
  `xcode-gemini`) are Xcode 26's bundled agents on macOS: each has an isolated
  config root under `~/Library/Developer/Xcode/CodingAssistant`, separate from
  the standalone CLI's `~/.claude`/`~/.codex`/`~/.gemini` (migrate between the
  two with e.g. `agentmove convert claude-code xcode-claude`). The file
  formats and lossy edges match the corresponding standalone client. Xcode
  itself may gate custom user-level MCP servers behind app settings
  ("Allow external agents to use Xcode tools" governs the reverse direction);
  project-level files (`.mcp.json`, `AGENTS.md`, `CLAUDE.md`) are shared with
  the standalone CLIs — use the standalone client id with `--project` for
  those. `xcode-codex` has no documented skills directory, so imported skills
  are skipped (warned).
- **goose** builtin/platform extensions are goose-internal and not exported;
  `available_tools` filters, keyring `env_keys`, and non-default per-extension
  timeouts have no portable equivalent (warned). Extensions are user-scoped
  only — `--project` covers `.goosehints`, `.goose/memory/`, and
  `.agents/skills/`.
- OpenClaw `toolFilter` and Hermes `tools.include/exclude` MCP filters have no
  portable equivalent and are dropped with a warning.
