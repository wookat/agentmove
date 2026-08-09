# agentmove

**Move your AI agent between clients.** The pandoc of agent ecosystems: migrate
**config + MCP servers + skills + memory + persona/instructions** between
forty-seven clients — OpenClaw, Hermes Agent, Claude Code, Codex CLI, Cursor,
Gemini CLI, VS Code, Cline, Continue, and more (see the full table below) — in
any direction, with dry-run previews, diffs, and honest loss reporting.

Existing migration tools (like `hermes claw migrate`) are one-way doors into a
single vendor. agentmove is neutral, local-only, and open source: your agent's
brain belongs to you.

![agentmove demo: doctor, dry-run convert, apply with backups, diff](docs/assets/demo.gif)

## Quick start

The npm package is **`agentmove-cli`** (the bare `agentmove` name collides with an
existing package under npm's hyphen-insensitive naming rules), but the installed
command is still `agentmove`:

```bash
npm install -g agentmove-cli   # installs the `agentmove` command
agentmove doctor
```

Or one-off with npx:

```bash
# See which agent clients live on this machine and what can be migrated
npx agentmove-cli doctor

# Preview a migration (nothing is written without --apply)
npx agentmove-cli convert openclaw hermes

# Actually migrate (existing files are backed up to ~/.agentmove/backups first)
npx agentmove-cli convert openclaw hermes --apply

# Or go through a portable bundle you can commit / carry to another machine
npx agentmove-cli export claude-code -o my-agent
npx agentmove-cli import codex -i my-agent --apply

# Compare two clients (or a bundle vs a client) layer by layer
npx agentmove-cli diff claude-code codex

# Partial migration: only the layers you ask for
npx agentmove-cli convert claude-code codex --only mcp --apply

# Project-scoped migration: .mcp.json / CLAUDE.md / .cursor/rules / GEMINI.md / AGENTS.md
npx agentmove-cli convert claude-code cursor --project . --apply
```

## What gets migrated

| Layer | Notes |
| --- | --- |
| MCP servers | Near-lossless between all forty-seven clients (JSON/JSON5/TOML/YAML shapes normalized) |
| Instructions | `AGENTS.md` ↔ `CLAUDE.md` ↔ `GEMINI.md` ↔ Cursor rules |
| Persona | `SOUL.md` (OpenClaw/Hermes native; approximated into instructions elsewhere, with a warning) |
| Memory | OpenClaw `MEMORY.md`/daily files, Hermes `§` entries, Gemini "Added Memories" — normalized entries + raw originals kept in the bundle |
| Skills | `SKILL.md` directories (the de-facto cross-client standard) |
| Custom agents | Subagent markdown definitions — Claude Code `~/.claude/agents/`, Copilot CLI `~/.copilot/agents/*.agent.md`, Gemini CLI `~/.gemini/agents/` (experimental), OpenCode `{agent,agents}/` in `~/.config/opencode/` and the `~/.opencode/` fallback (recursive, nested names preserved; the fallback dir wins duplicates with a warning; imports write `~/.config/opencode/agents/`), Qwen Code `~/.qwen/agents/`, Cursor `~/.cursor/agents/`, Kiro `~/.kiro/agents/`, Droid `~/.factory/droids/`, CodeBuddy `~/.codebuddy/agents/`, Qoder CLI `~/.qoder/agents/`, Kimi Code CLI `~/.kimi-code/agents/` + shared `~/.agents/agents/` (recursive), Kilo Code `~/.config/kilo/agents/` (recursive, nested names preserved; `agent/` and legacy `~/.kilocode/`/`~/.kilo/` roots also read, `~/.config/kilo/` wins), Amazon Q Developer CLI `~/.aws/amazonq/cli-agents/*.json` (documented conversion: `description` + `prompt` only, other fields warned), Roo Code custom modes in globalStorage `settings/custom_modes.yaml` (documented conversion: `slug` + `description` + `roleDefinition` only, other fields warned; project scope `.roomodes`), Nanocoder `~/.config/nanocoder/agents/` (flat; imports inject the `name`/`description` frontmatter nanocoder requires when missing, warned), Auggie CLI `~/.augment/agents/` (recursive, nested names preserved; `.txt` agents exported with a warning), Codex CLI `~/.codex/agents/*.toml` (agent role files, recursive; documented conversion: `name` + `description` + `developer_instructions` only, other settings warned), Grok CLI `subAgents` entries in `~/.grok/user-settings.json` (documented conversion: `instruction` only, the per-agent `model` is warned; imports assign the grok default model), Vibe Code CLI `~/.vibe/agents/*.toml` profiles + `~/.vibe/prompts/`; frontmatter is copied as-is with a warning, other clients skip with a warning |
| Commands / prompts | Markdown slash commands & custom prompts — Claude Code `~/.claude/commands/` (nested subdirectories preserved), Cursor `~/.cursor/commands/`, Codex `~/.codex/prompts/` (deprecated in favor of skills but still supported), OpenCode `{command,commands}/` in `~/.config/opencode/` and the `~/.opencode/` fallback (nested preserved; the fallback dir wins duplicates with a warning; imports write `~/.config/opencode/commands/`), Qwen Code `~/.qwen/commands/` (nested preserved; deprecated TOML commands are warned, not migrated), Windsurf `~/.codeium/windsurf/global_workflows/` (workflows; flat), Amazon Q CLI `~/.aws/amazonq/prompts/` (saved prompts; flat), Kiro `~/.kiro/prompts/` (saved prompts; flat, invoked as `@name`), CodeBuddy `~/.codebuddy/commands/` (nested preserved; invoked as `/group:command`), Droid `~/.factory/commands/` (nested preserved; shebang script commands are warned, not migrated), Qoder CLI `~/.qoder/commands/` (nested preserved; invoked as `/group:command`), Roo Code `~/.roo/commands/` (flat), Kilo Code `~/.config/kilo/commands/` (flat; legacy `~/.kilocode/workflows/` also read, new location wins), Cline `~/Documents/Cline/Workflows/` (workflows; flat, non-markdown files warned), Auggie CLI `~/.augment/commands/` (nested preserved; invoked as `/namespace:command`), Nanocoder `~/.config/nanocoder/commands/` (nested preserved; directory-as-command bundles export their markdown, `resources/` files warned), Continue `~/.continue/prompts/` (prompt files; nested preserved; `invokable: true` frontmatter required by Continue to list them; legacy v1 `.prompt` files warned, not migrated), VS Code default-profile `User/prompts/*.prompt.md` (Copilot prompt files; flat), Gemini CLI `~/.gemini/commands/**/*.toml` (nested preserved; TOML `prompt`/`description` converted to/from markdown — a format conversion, warned), Crush `~/.config/crush/commands/` (nested preserved; the secondary `~/.crush/commands/` root is also read, XDG wins), Trae `~/.trae/commands/` (nested preserved; the CN-edition `~/.trae-cn/commands/` root is also read, `~/.trae/` wins; Trae reads at most 3 nested levels, deeper imports are warned), Cortex Code `~/.snowflake/cortex/commands/` (nested preserved; user scope only), goose `~/.config/goose/recipes/*.yaml|json` (recipes; flat — `prompt`/`instructions` converted to/from markdown and imports register `slash_commands` in config.yaml, a format conversion, warned), Antigravity `~/.gemini/config/global_workflows/` (workflows; flat, triggered as `/name`), GitHub Copilot CLI project `.claude/commands/` (Claude-compatible single-file commands; project scope only — `~/.claude/` is no longer loaded by copilot), argument placeholders and frontmatter are client-specific (warned), other clients skip with a warning |
| Config | Default model plus the raw source config preserved in the bundle for reference |

Every lossy or approximated step is reported as a warning — nothing is silently
dropped. Likely secrets (env/header values named `*KEY*`, `*TOKEN*`, `*AUTHORIZATION*`, …) are replaced
with `${VAR}` placeholders — in the portable MCP list and recursively throughout the raw
config snapshot kept in the bundle — unless you pass `--include-secrets`.

## What does NOT migrate (honest edition)

- **Cursor memories** live in the app's internal database — cannot be exported or imported.
- **Claude Code / Codex client-managed memories** are not exported; imported memory is
  appended to the instructions file (`CLAUDE.md` / `AGENTS.md`) as an *approximation*,
  not written into the client's own memory store.
- **Persona** is native only in OpenClaw/Hermes (`SOUL.md`); everywhere else it's appended
  to instructions and flagged `approximated`.
- **MCP tool filters** (OpenClaw `toolFilter`, Hermes include/exclude) have no portable
  equivalent — dropped with a warning.
- **OpenClaw / Hermes** have no project-scoped files — `--project` covers
  claude-code, codex, cursor, gemini, windsurf, cline (`.clinerules/` + `.cline/skills/` + `.clinerules/workflows/`), zed (`.zed/settings.json` + `.rules` + `.agents/skills/`), openhands,
  copilot (`.mcp.json` + `.github/instructions/` + `.github/skills/` + `.github/agents/` + `.claude/commands/`), opencode, qwen, amp (`.amp/settings.json` workspace servers), vscode (`.vscode/mcp.json` + `.github/copilot-instructions.md` + `.github/skills/` + `.github/prompts/`), kiro (`.kiro/settings/mcp.json` + `.kiro/steering/` + `.kiro/skills/` + `.kiro/prompts/`), roo (`.roo/mcp.json` + `.roo/rules/` + `.roo/skills/` + `.roo/commands/`), continue (`.continue/mcpServers/` blocks + `.continue/rules/` + `.continue/skills/` + `.continue/prompts/`), crush (`crush.json`/`.crush.json` + `CRUSH.md` + `.crush/skills/` + `.crush/commands/`), antigravity (`.agents/mcp_config.json` + `.agents/rules/` + `.agents/skills/`), droid (`.factory/mcp.json` + `AGENTS.md` + `.factory/skills/` + `.factory/commands/`), amazonq (`.amazonq/mcp.json` + `AmazonQ.md` + `.amazonq/prompts/`), warp (`.warp/.mcp.json` + `AGENTS.md` + `.warp/skills/`), junie (`.junie/mcp/mcp.json` + `.junie/AGENTS.md` + `.junie/skills/`), trae (`.trae/mcp.json` + `.trae/rules/` + `.trae/skills/` + `.trae/commands/`), jetbrains (`.ai/mcp/mcp.json` + `.aiassistant/rules/`), comate (`.comate/mcp.json` + `.comate/rules/` + `.comate/skills/`), codebuddy (`.mcp.json` + `CODEBUDDY.md` + `.codebuddy/skills/` + `.codebuddy/agents/` + `.codebuddy/commands/`), qoder (`.mcp.json` + `AGENTS.md` + `.qoder/skills/` + `.qoder/agents/` + `.qoder/commands/`), auggie (`.augment/settings.json` + `.augment/rules/` + `.augment/skills/` + `.augment/commands/` + `.augment/agents/`), kilo (`kilo.json`/`.kilo/kilo.json` + `AGENTS.md` + `.kilo/skills/` + `.kilo/commands/`), kimi (`.kimi-code/mcp.json` + `AGENTS.md` + `.kimi-code/skills/` + `.kimi-code/agents/` + `.agents/agents/`), cortex (`.cortex/mcp.json` + `AGENTS.md` + `.cortex/skills/`), librechat (`librechat.yaml` in the deployment directory), muse (root `AGENTS.md` + `.agents/skills/` + `.agents/memory/`), warp-cli (root `AGENTS.md`/`WARP.md` + `.agents/skills/`), and goose (`.goosehints`/`.goose/memory`/`.agents/skills`/`.goose/recipes`;
  goose extensions are user-scoped only).
- **Cline VS Code extension** keeps its own MCP settings copy in VS Code
  globalStorage — only the CLI settings file (`~/.cline`) and global rules are
  migrated. Skills migrate natively (`~/.cline/skills/`, project
  `.cline/skills/`).
- **Windsurf Cascade memories** are app-managed — cannot be exported or imported;
  durable rules live in `global_rules.md` (migrated as instructions). Skills
  migrate natively (`~/.codeium/windsurf/skills/`, project `.windsurf/skills/`).
- **Zed Rules Library** entries are app-managed — not migrated; personal
  instructions live in `~/.config/zed/AGENTS.md`. Skills migrate natively
  (`~/.agents/skills/`, project `.agents/skills/`). JSONC comments in Zed's
  `settings.json` are not preserved on rewrite (warned).
- **OpenHands remote MCP servers** only support `api_key` auth — non-Bearer
  headers are dropped with a warning; per-server `timeout` has no portable
  equivalent. Skills migrate natively from `~/.agents/skills/` plus the
  legacy `~/.openhands/skills/` (`.agents/skills` wins duplicate names;
  project `.agents/skills/` + `.openhands/skills/` with `--project`);
  imports write `.agents/skills/`. The managed `~/.openhands/skills/installed/`
  store is not exported (warned).

Full details: [Limitations](https://agentmove.zalize.com/docs/limitations/).

## Supported clients

| Client | id | Data read from |
| --- | --- | --- |
| OpenClaw | `openclaw` | `~/.openclaw/openclaw.json`, workspace (`SOUL.md`, `AGENTS.md`, `MEMORY.md`, `memory/`, `skills/`) |
| Hermes Agent | `hermes` | `~/.hermes/config.yaml`, `SOUL.md`, `memories/`, `skills/` |
| Claude Desktop | `claude-desktop` | `claude_desktop_config.json` (`mcpServers`; macOS `~/Library/Application Support/Claude`, Windows `%APPDATA%\Claude`, Linux `~/.config/Claude`) + `~/.claude/skills/` |
| Claude Code | `claude-code` | `~/.claude.json`, `~/.claude/CLAUDE.md`, `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/commands/` |
| Codex CLI | `codex` | `~/.codex/config.toml` (incl. `bearer_token_env_var`/`env_http_headers` as `${VAR}` placeholder headers), `~/.codex/AGENTS.md`, `~/.agents/skills/`, `~/.codex/prompts/` (custom prompts) |
| Cursor | `cursor` | `~/.cursor/mcp.json` + `~/.cursor/skills/` + `~/.cursor/agents/` + `~/.cursor/commands/` (rules/memories are project/app-scoped) |
| Gemini CLI | `gemini` | `~/.gemini/settings.json`, `~/.gemini/GEMINI.md`, `~/.gemini/skills/`, `~/.gemini/agents/` (experimental subagents), `~/.gemini/commands/` (TOML custom commands, converted) |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json`, `~/.codeium/windsurf/memories/global_rules.md`, `~/.codeium/windsurf/skills/`, `~/.codeium/windsurf/global_workflows/` (workflows as commands) |
| Cline | `cline` | `~/.cline/data/settings/cline_mcp_settings.json`, `~/Documents/Cline/Rules/`, `~/.cline/skills/`, `~/Documents/Cline/Workflows/` (workflow slash commands) |
| Zed | `zed` | `~/.config/zed/settings.json` (`context_servers`), `~/.config/zed/AGENTS.md`, `~/.agents/skills/` |
| OpenHands | `openhands` | `~/.openhands/config.toml` (`[mcp]`), `~/.openhands/microagents/`, `~/.agents/skills/` (+ legacy `~/.openhands/skills/`) |
| GitHub Copilot CLI | `copilot` | `~/.copilot/mcp-config.json`, `~/.copilot/copilot-instructions.md` + `~/.copilot/instructions/`, `~/.copilot/skills/`, `~/.copilot/agents/*.agent.md` (project scope adds `.claude/commands/`) |
| OpenCode | `opencode` | `~/.config/opencode/opencode.json` (`mcp`), `~/.config/opencode/AGENTS.md`, skills from `~/.config/opencode/{skills,skill}/` + the `~/.opencode/{skills,skill}/` fallback + shared `~/.agents/skills/` (first root wins duplicates; imports write `~/.config/opencode/skills/`), custom agents from `{agent,agents}/` and custom commands from `{command,commands}/` in both config dirs (fallback dir wins duplicates; imports write `~/.config/opencode/agents/` and `commands/`) |
| Qwen Code | `qwen` | `~/.qwen/settings.json` (`mcpServers`), `~/.qwen/QWEN.md` (incl. "Qwen Added Memories"), `~/.qwen/skills/`, `~/.qwen/agents/` (custom subagents), `~/.qwen/commands/` (custom commands; markdown only) |
| Amp | `amp` | `~/.config/amp/settings.json` (`amp.mcpServers`), `~/.config/amp/AGENTS.md`, `~/.config/agents/skills/` + `~/.agents/skills/` + `~/.config/amp/skills/` |
| VS Code | `vscode` | user-profile `mcp.json` (`servers`; Linux `~/.config/Code/User`, macOS `~/Library/Application Support/Code/User`, Windows `%APPDATA%\Code\User`) + `~/.agents/skills/` + default-profile `User/prompts/*.prompt.md` |
| Kiro | `kiro` | `~/.kiro/settings/mcp.json` (`mcpServers`), `~/.kiro/steering/`, `~/.kiro/skills/`, `~/.kiro/agents/` (markdown custom agents; JSON configs warned), `~/.kiro/prompts/` (saved prompts as commands) |
| Roo Code | `roo` | VS Code globalStorage `mcp_settings.json` (`mcpServers`) + `custom_modes.yaml` (custom modes), `~/.roo/rules/`, `~/.roo/skills/` |
| Continue | `continue` | `~/.continue/config.yaml` (`mcpServers` list), `~/.continue/rules/`, `~/.continue/skills/`, `~/.continue/prompts/` |
| Crush | `crush` | `~/.config/crush/crush.json` (`mcp`), `~/.config/crush/skills/`, `~/.config/crush/commands/` (+ `~/.crush/commands/`) |
| goose | `goose` | `~/.config/goose/config.yaml` (`extensions` + `slash_commands`), `~/.config/goose/.goosehints`, `~/.config/goose/memory/`, `~/.agents/skills/`, `~/.config/goose/recipes/` |
| Antigravity | `antigravity` | `~/.gemini/config/mcp_config.json` (`mcpServers`), `~/.gemini/config/skills/`, `~/.gemini/config/global_workflows/` (workflows as commands) — the shared Antigravity 2.0 config used by the desktop app, the IDE, and the Antigravity CLI (`agy`) |
| Droid | `droid` | `~/.factory/mcp.json` (`mcpServers`), `~/.factory/AGENTS.md`, `~/.factory/skills/`, `~/.factory/droids/` (custom droids / subagents), `~/.factory/commands/` (custom slash commands) |
| Amazon Q Developer CLI | `amazonq` | `~/.aws/amazonq/mcp.json` (`mcpServers`), `~/.aws/amazonq/prompts/` (saved prompts as commands); project scope: `.amazonq/mcp.json` + `AmazonQ.md` + `.amazonq/prompts/` |
| Warp | `warp` | `~/.warp/.mcp.json` (`mcpServers`, no `type` field), `~/.warp/skills/`; project scope: `.warp/.mcp.json` + `AGENTS.md` + `.warp/skills/` |
| Junie | `junie` | `~/.junie/mcp/mcp.json` (`mcpServers`) + `~/.junie/AGENTS.md` + `~/.junie/skills/`; project scope: `.junie/mcp/mcp.json` + `.junie/AGENTS.md` + `.junie/skills/` |
| LM Studio | `lmstudio` | `~/.lmstudio/mcp.json` (`mcpServers`, Cursor-style notation); MCP servers only — everything else is app-managed |
| Trae | `trae` | `~/.trae/skills/` (global Agent Skills), `~/.trae/commands/` (+ `~/.trae-cn/commands/`); MCP/rules are project-scoped: `.trae/mcp.json` (`mcpServers`) + `.trae/rules/` + `.trae/skills/` |
| CodeBuddy | `codebuddy` | `~/.codebuddy/.mcp.json` (`mcpServers` + `disabledMcpServers` name list; JSONC accepted, `mcp.json`/`~/.codebuddy.json` read as fallbacks), `~/.codebuddy/CODEBUDDY.md` (user memory), `~/.codebuddy/skills/` (Agent Skills standard), `~/.codebuddy/agents/` (custom sub-agents), `~/.codebuddy/commands/` (custom slash commands) |
| Qoder CLI | `qoder` | `~/.qoder/settings.json` (`mcpServers` key; other settings preserved), `~/.qoder/AGENTS.md` (user memory), `~/.qoder/skills/` (Agent Skills standard), `~/.qoder/agents/` (custom subagents) |
| Auggie CLI | `auggie` | `~/.augment/settings.json` (`mcpServers` key; other settings preserved), `~/.augment/rules/` (user rules), `~/.augment/skills/` (Agent Skills standard), `~/.augment/commands/` (custom slash commands; nested namespaces preserved) |
| Kilo Code | `kilo` | `~/.config/kilo/kilo.json` (`mcp` key; `type: local/remote`, native `enabled` flag; kilo.jsonc/config.json also read), `~/.config/kilo/AGENTS.md` (global instructions), `~/.kilo/skills/` (Agent Skills standard), `~/.config/kilo/agents/` + `agent/` (custom agents/modes, recursive; legacy `~/.kilocode/` + `~/.kilo/` roots also read), `~/.config/kilo/commands/` (slash commands; legacy `~/.kilocode/workflows/` also read) |
| Kimi Code CLI | `kimi` | `~/.kimi-code/mcp.json` (`mcpServers` key; stdio uses `command`/`args`/`env`/`cwd`, HTTP uses plain `url`, SSE sets `transport: "sse"`; native `enabled` flag), `~/.kimi-code/AGENTS.md` (global instructions), `~/.kimi-code/skills/` + shared `~/.agents/skills/` (Agent Skills standard; brand root wins duplicate names), `~/.kimi-code/agents/` + shared `~/.agents/agents/` (custom agents, recursive) |
| Grok CLI | `grok` | `~/.grok/config.toml` (`[mcp_servers.*]` tables; stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.grok/AGENTS.md` (global rules), `~/.agents/skills/` (Agent Skills standard; legacy `~/.grok/skills/` still read with a warning), `subAgents` in `~/.grok/user-settings.json` (custom sub-agents) |
| Vibe Code CLI | `vibe` | `~/.vibe/config.toml` (`[[mcp_servers]]` array of tables with explicit `transport`; stdio uses `command`/`args`/`env`, remote uses `url`/`headers`), `~/.vibe/AGENTS.md` (global instructions), `~/.vibe/skills/` (Agent Skills standard), `~/.vibe/agents/` (custom agents: TOML profiles + `~/.vibe/prompts/` prompt files) |
| Nanocoder | `nanocoder` | `~/.config/nanocoder/.mcp.json` (`mcpServers` map with explicit `transport`; stdio uses `command`/`args`/`env`, HTTP uses `url`/`headers`, `enabled` flag round-trips; websocket servers skipped), `~/.config/nanocoder/commands/` (custom slash commands; nested namespaces preserved, directory-as-command `resources/` warned), `~/.config/nanocoder/agents/` (custom subagents; flat), `~/.config/nanocoder/skills/` (skill bundles; `commands/` members export as `<bundle>/<name>` and the single `agents/` subagent exports by file name — bundle `tools/` and `skill.yaml` extras are nanocoder-specific, warned); instructions live in the project-root `AGENTS.md` (`--project`), Agent Skills-standard skills are not migrated |
| Jan | `jan` | `~/.local/share/Jan/data/mcp_config.json` (`mcpServers` map; every entry carries `command`/`args`, remote entries add `type: http/sse` + `url`/`headers`, native `active` flag round-trips; `mcpSettings` and other keys preserved); assistants, models, and chats are app-managed |
| AnythingLLM | `anythingllm` | `~/.config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json` (`mcpServers` map; stdio uses `command`/`args`/`env`, remote uses `url`/`headers` + optional `type` — `streamable`/`http` mean Streamable HTTP, omitted means SSE; `anythingllm.autoStart: false` round-trips as the disabled flag); workspaces, prompts, and chats are app-managed |
| LibreChat | `librechat` | `librechat.yaml` in the deployment directory (`--project`; `mcpServers` map — stdio uses `command`/`args`/`env`, remote uses `url`/`headers` with `type: sse`/`streamable-http`; websocket servers are skipped; `timeout`/`customUserVars`/`oauth` etc. are client-specific; other yaml keys preserved); prompts, agents, and memory are app-managed |
| Xcode Claude Agent | `xcode-claude` | `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig` (macOS; Xcode 26's bundled Claude Agent — same `.claude.json` + `.claude/CLAUDE.md` + `.claude/skills` layout as Claude Code, isolated from `~/.claude`) |
| Xcode Codex | `xcode-codex` | `~/Library/Developer/Xcode/CodingAssistant/codex` (macOS; Xcode 26's bundled Codex — same `config.toml` + `AGENTS.md` layout as Codex CLI, isolated from `~/.codex`; no documented skills directory) |
| Xcode Gemini | `xcode-gemini` | `~/Library/Developer/Xcode/CodingAssistant/gemini` (macOS; Xcode 26's bundled Gemini — same `settings.json` + `GEMINI.md` layout as Gemini CLI, isolated from `~/.gemini`) |
| JetBrains AI Assistant | `jetbrains` | `~/.ai/mcp/mcp.json` (`mcpServers`; stdio uses `command`/`args`/`env` + native `workingDirectory`, remote uses `url`/`headers`; shared by the JetBrains AI agents in IntelliJ-family IDEs); project scope: `.ai/mcp/mcp.json` + `.aiassistant/rules/*.md`; prompts and chat memory are IDE-managed |
| Baidu Comate | `comate` | `~/.comate/skills/` (global Agent Skills standard); MCP servers and rules are project-scoped: `.comate/mcp.json` (`mcpServers`) + `.comate/rules/*.mdr` + `.comate/skills/`; chat memory is app-managed |
| Warp Agent CLI | `warp-cli` | `~/.warp_cli/.mcp.json` (`mcpServers`, own server set separate from the Warp app) + shared `~/.agents/AGENTS.md` global rules and `~/.agents/skills/` (Agent Skills standard); project scope covers root `AGENTS.md` (or `WARP.md`) and `.agents/skills/` — project `.warp/.mcp.json` belongs to the `warp` client |
| Muse Code | `muse` | `~/.config/muse/settings.json` (`mcp_servers`, explicit `transport: stdio/streamable_http`) + `~/.config/muse/skills/` (Agent Skills standard); project scope covers root `AGENTS.md`, `.agents/skills/`, and `.agents/memory/` durable memory; machine-wide user rules and personal memory are app-managed |
| Cortex Code | `cortex` | `~/.snowflake/cortex/mcp.json` (`mcpServers` key with explicit `type: stdio/http/sse`; stdio uses `command`/`args`/`env`/`cwd`, remote uses `url`/`headers`), `~/.snowflake/cortex/AGENTS.md` (user instructions), `~/.snowflake/cortex/skills/` (Agent Skills standard), `~/.snowflake/cortex/commands/` (custom commands); project scope covers `.cortex/mcp.json`, root `AGENTS.md`, and `.cortex/skills/` |

## Commands

- `agentmove export <client> [-o dir]` — client → portable bundle
- `agentmove import <client> [-i dir] [--apply]` — bundle → client (dry-run by default)
- `agentmove convert <from> <to> [--apply]` — direct client → client
- `agentmove pack <bundle> [-o file]` / `agentmove unpack <file>` — encrypt a
  bundle into a single portable `.agentpack` file (AES-256-GCM, passphrase from
  `AGENTMOVE_PASSPHRASE`) for carrying an agent across machines; `import -i`
  accepts `.agentpack` files directly
- `--only mcp,skills,…` (on export/import/convert) — partial migration of just
  the listed layers (`mcp`, `skills`, `memory`, `instructions`, `persona`)
- `--project <dir>` (on export/import/convert) — migrate the client's
  project-scoped files in a repo (`.mcp.json`/`CLAUDE.md`, `AGENTS.md`,
  `.gemini/settings.json`/`GEMINI.md`, `.cursor/mcp.json`/`.cursor/rules`,
  `.windsurf/rules`, `.clinerules`, `.zed/settings.json`/`.rules`,
  `.openhands/microagents`+`.openhands/skills`,
  `.mcp.json`+`.github/copilot-instructions.md` for copilot,
  `opencode.json`+`AGENTS.md`+`.opencode/skills`+`.opencode/agents` for opencode,
  `.qwen/settings.json`+`QWEN.md`+`.qwen/skills`+`.qwen/agents` for qwen) instead of
  user-scoped config; openclaw/hermes have no project scope
- `--mif <file>` (on `export`) / `import <client> --mif <file>` — exchange the
  memory layer as a vendor-neutral [MIF v2](https://github.com/varun29ankuS/mif-spec)
  document with any MIF-speaking memory system
- `export <client> --plugin` — write an [Agent Plugin](https://agent-plugins.org)
  (`plugin.json` + `skills/` + `mcp.json` with explicit transport types) instead of
  an agentmove bundle; `import -i` auto-detects Agent Plugin directories, so any
  plugin from the ecosystem can be imported into all supported clients
  (instructions/persona/memory have no plugin slot and are warned about)
- `export <client> --mcp-json <file>` — also write the MCP layer as a standalone
  standard `mcp.json` (explicit `type` on every entry, secrets redacted by
  default) — a shareable canonical server list for a team or any
  `mcpServers`-speaking tool
- `import <client> -i mcp.json` — import a standalone MCP config file (any
  `mcpServers` map: an Agent Plugins `mcp.json`, a Claude-style `.mcp.json`,
  a canonical team server list, …) directly into any client; transports are
  taken from `type`/`transport` or inferred from `command`/`url` with a warning
- `import <client> -i <url>` — import straight from an http(s) URL: a `.json`
  URL is fetched as a standalone MCP config, any other URL is `git clone`d and
  auto-detected as an Agent Plugin, agentmove bundle, or skills repository; a
  GitHub-style `/tree/<branch>/<dir>` (or GitLab `/-/tree/`) URL imports just
  that directory, a `blob` link to a `.json` file fetches the raw file, and a
  `.zip`/`.tgz`/`.tar.gz` URL (release asset, "Download ZIP" link) is
  downloaded and extracted — local archive files work too
- `export <client> --plugin -o my-plugin.zip` — package the plugin as a
  ready-to-publish archive (`.zip`/`.tgz`/`.tar.gz`), e.g. a release asset
- `import <client> -i <repo>` — import a skills repository (the
  [skills.sh](https://skills.sh) / `npx skills add owner/repo` ecosystem):
  `SKILL.md` directories under `skills/`, namespaced under
  `skills/<scope>/` (the `gh skill` convention), at the top level, or a
  single skill at the repository root, installed into any client's skills
  location
- `export <client> --skills-repo <dir>` — also write the skills layer as a
  skills repository (`skills/<name>/SKILL.md`), ready to commit and publish
  with `gh skill publish` or install with `npx skills add`; a path ending in
  `.zip`/`.tgz`/`.tar.gz` writes it as an archive; `gh skill install`
  source-tracking metadata (`metadata.github-*`) is stripped with a warning
  so the result passes `gh skill publish` validation
- `agentmove diff <from> <to>` — layer-by-layer comparison
- `agentmove doctor` — detect installed clients and inventory migratable data
- `agentmove clients` — list supported clients and default config locations
- `agentmove completion <bash|zsh|fish>` — shell completion script

All data commands accept `--json` for machine-readable output (plans,
warnings, per-layer summary) — handy in scripts and CI. A global install also
links a man page (`man agentmove-cli`), and `--debug` (or
`AGENTMOVE_DEBUG=1`) prints a stack trace on unexpected errors.

## Safety model

1. **Dry-run by default** — `import`/`convert` print a plan; `--apply` is explicit.
2. **Automatic backups** — every file that would be overwritten is copied to
   `~/.agentmove/backups/<timestamp>/` first.
3. **Merge, don't clobber** — imported MCP servers merge into the target's
   existing list (like the official `mcp add` commands); nothing the target
   already has is removed unless you pass `--replace-mcp`.
4. **Secrets stay put** — redacted to `${VAR}` placeholders unless
   `--include-secrets` is passed.

Exit codes: `0` success · `1` unexpected error · `2` usage error · `3` bad
input data (messages include the offending file path).

## Development

```bash
pnpm install
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Adapters are plugins: implement the `ClientAdapter` interface in
`packages/agentmove/src/adapters/` and register it in `adapters/index.ts`.
Research behind the format mappings lives in
[`docs/research/`](docs/research/) (proposal, competitive comparison, and the
per-client format matrix).

## License

Apache-2.0
