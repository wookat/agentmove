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
| VS Code | `vscode` | user-profile `mcp.json` (`servers`; stdio entries use `command`/`args`/`env`, remote use `type: http`/`sse` + `url`/`headers`); profile folder is `~/.config/Code/User` (Linux), `~/Library/Application Support/Code/User` (macOS), or `%APPDATA%\Code\User` (Windows) — all three are checked |
| Kiro | `kiro` | `~/.kiro/settings/mcp.json` (`mcpServers`; stdio entries use `command`/`args`/`env` + native `disabled`, remote use `url`/`headers`), steering markdown in `~/.kiro/steering/` (AGENTS.md standard supported), `~/.kiro/skills/` (Agent Skills standard) |
| Roo Code | `roo` | VS Code globalStorage `mcp_settings.json` (`mcpServers`; stdio entries use `command`/`args`/`env` + native `disabled`, remote entries require an explicit `type: streamable-http`/`sse` + `url`/`headers`) — `~/.config/Code/User` (Linux), `~/Library/Application Support/Code/User` (macOS), or `%APPDATA%\Code\User` (Windows); rules markdown in `~/.roo/rules/`, `~/.roo/skills/` (Agent Skills standard) |
| Continue | `continue` | `~/.continue/config.yaml` (`mcpServers` **list**; each entry carries its own `name`, stdio uses `command`/`args`/`env`/`cwd`, remote uses `type: streamable-http`/`sse` + `url`), rules markdown in `~/.continue/rules/` |
| Crush | `crush` | `~/.config/crush/crush.json` (`mcp`; `type` is required — `stdio` uses `command`/`args`/`env`, `http`/`sse` use `url`/`headers` — plus a native `disabled` flag), `~/.config/crush/skills/` (Agent Skills standard); context files (CRUSH.md/AGENTS.md) are project-scoped only |
| goose | `goose` | `~/.config/goose/config.yaml` (`extensions`; stdio uses `cmd`/`args`/`envs`, remote uses `streamable_http`/`sse` + `uri`), `~/.config/goose/.goosehints`, memory-extension files in `~/.config/goose/memory/`, `~/.agents/skills/` |
| Antigravity | `antigravity` | `~/.gemini/config/mcp_config.json` (`mcpServers`; stdio uses `command`/`args`/`env`/`cwd`, remote servers require `serverUrl` — legacy `url`/`httpUrl` are not supported — plus `headers`, and a native `disabled` flag), `~/.gemini/config/skills/` (Agent Skills standard); global rules live in `~/.gemini/GEMINI.md`, shared with Gemini CLI |
| Droid | `droid` | `~/.factory/mcp.json` (`mcpServers`; `type` is `stdio`/`http`/`sse` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`, plus a native `disabled` flag), `~/.factory/AGENTS.md` (personal instructions), `~/.factory/skills/` (Agent Skills standard) |
| Amazon Q Developer CLI | `amazonq` | `~/.aws/amazonq/mcp.json` (`mcpServers`; `type` is `stdio` or `http` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`, plus a native `disabled` flag); the built-in default agent loads it via `useLegacyMcpJson` |
| Warp | `warp` | `~/.warp/.mcp.json` (`mcpServers`; entries have **no `type` field** — stdio uses `command`/`args`/`env` + optional `working_directory`, remote uses `url`/`headers` with auto-negotiated transport); global rules live in Warp Drive (app-managed) |
| Junie | `junie` | `~/.junie/mcp/mcp.json` (`mcpServers`; entries have no `type` field — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; shared by the JetBrains IDE plugin and Junie CLI), global guidelines in `~/.junie/AGENTS.md`, `~/.junie/skills/` (Agent Skills standard) |
| LM Studio | `lmstudio` | `~/.lmstudio/mcp.json` (`mcpServers`, Cursor-style notation — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; no `type` field); MCP servers only — models, presets, and chats are app-managed |
| Trae | `trae` | `~/.trae/skills/` (global Agent Skills standard); user-level MCP servers, rules, and memories are app-managed (Settings UI) — project scope is where Trae's files live: `.trae/mcp.json` (`mcpServers`; entries have no `type` field — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `.trae/rules/*.md`, and `.trae/skills/` |
| CodeBuddy | `codebuddy` | `~/.codebuddy/.mcp.json` (`mcpServers`; `type` is `stdio`/`sse`/`http` and may be omitted — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`; a top-level `disabledMcpServers` name list carries the disabled state; JSONC accepted; `~/.codebuddy/mcp.json` and `~/.codebuddy.json` are read as legacy fallbacks), `~/.codebuddy/CODEBUDDY.md` (user memory file), `~/.codebuddy/skills/` (Agent Skills standard) |
| Qoder CLI | `qoder` | `~/.qoder/settings.json` (`mcpServers` key inside the general settings file — other settings are preserved on rewrite; `type` is `stdio`/`sse`/`http`/`ws` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.qoder/AGENTS.md` (user memory file), `~/.qoder/skills/` (Agent Skills standard) |
| Auggie CLI | `auggie` | `~/.augment/settings.json` (`mcpServers` key inside the general settings file — other settings are preserved on rewrite; `type` is `stdio`/`sse`/`http` and may be omitted for stdio — stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.augment/rules/*.md` (user rules, always applied), `~/.augment/skills/` (Agent Skills standard) |
| Kilo Code | `kilo` | `~/.config/kilo/kilo.json` (`mcp` key inside the general config file — other keys are preserved on rewrite; `kilo.jsonc`/`config.json` also read, JSONC accepted; local servers use `type: "local"` with `command` as an argv array plus `environment`, remote servers use `type: "remote"` + `url`/`headers`; native `enabled` flag round-trips), `~/.config/kilo/AGENTS.md` (global instructions), `~/.kilo/skills/` (Agent Skills standard; shared by the CLI and the VS Code/JetBrains extensions) |
| Kimi Code CLI | `kimi` | `~/.kimi-code/mcp.json` (`mcpServers` key; stdio uses `command`/`args`/`env`/`cwd`, HTTP uses a plain `url` with optional `headers`, legacy SSE sets `transport: "sse"`; native `enabled` flag round-trips; `bearerTokenEnvVar`/`startupTimeoutMs`/`toolTimeoutMs`/`enabledTools`/`disabledTools` are client-specific), `~/.kimi-code/AGENTS.md` (global instructions), `~/.kimi-code/skills/` (Agent Skills standard; `$KIMI_CODE_HOME` relocations are not followed) |

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
- **VS Code** instructions/prompts/chat modes are profile- or repo-managed —
  user scope migrates MCP servers only (`--project` covers `.vscode/mcp.json`
  and `.github/copilot-instructions.md`); `inputs` prompted placeholders are
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
  disabled servers are emitted enabled (warned); no SKILL.md mechanism, so
  skills are skipped (warned); memory has no durable store and is skipped on
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
  import (warned).
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
  Drive (app-managed) and skills are app-bundled — instructions, persona,
  memory, and skills are skipped at user level (warned). `--project` covers
  `.warp/.mcp.json` and `AGENTS.md` (legacy `WARP.md` is read).
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
- **goose** builtin/platform extensions are goose-internal and not exported;
  `available_tools` filters, keyring `env_keys`, and non-default per-extension
  timeouts have no portable equivalent (warned). Extensions are user-scoped
  only — `--project` covers `.goosehints`, `.goose/memory/`, and
  `.agents/skills/`.
- OpenClaw `toolFilter` and Hermes `tools.include/exclude` MCP filters have no
  portable equivalent and are dropped with a warning.
