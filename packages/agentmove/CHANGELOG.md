# agentmove-cli

## 0.33.0

### Minor Changes

- b9f65ad: Vibe Code CLI (Mistral) adapter (35th client): `~/.vibe/config.toml` `[[mcp_servers]]` array-of-table entries with explicit `transport` (stdio `command`/`args`/`env`, remote `url`/`headers`; other config keys preserved on rewrite; `api_key_env`/`api_key_header`/`api_key_format`, `startup_timeout_sec`/`tool_timeout_sec`, and `enabled_tools`/`disabled_tools` reported as client-specific), `~/.vibe/AGENTS.md` global instructions (persona approximated), and `~/.vibe/skills/` Agent Skills. Project scope covers `.vibe/config.toml`, root `AGENTS.md`, and `.vibe/skills/`.

## 0.32.0

### Minor Changes

- 1959f5f: Add Grok CLI (xAI Grok Build) as the 34th supported client. User scope
  migrates the `[mcp_servers.*]` tables of `~/.grok/config.toml` (stdio uses
  `command`/`args`/`env`, remote uses `url`/`headers`; other config tables are
  preserved on rewrite; `startup_timeout_sec`/`tool_timeout_sec` are
  client-specific and warned), `~/.grok/AGENTS.md` global rules, and
  `~/.grok/skills/` Agent Skills. `--project` covers `.grok/config.toml`,
  root `AGENTS.md`, and `.grok/skills/`.

## 0.31.0

### Minor Changes

- 4768099: Add Kimi Code CLI (Moonshot AI) as the 33rd supported client. User scope
  migrates the `mcpServers` key of `~/.kimi-code/mcp.json` (stdio uses
  `command`/`args`/`env`/`cwd`, HTTP uses a plain `url` with optional
  `headers`, legacy SSE sets `transport: "sse"`; native `enabled` flag
  round-trips; `bearerTokenEnvVar`/`startupTimeoutMs`/`toolTimeoutMs`/
  `enabledTools`/`disabledTools` are client-specific and warned),
  `~/.kimi-code/AGENTS.md` global instructions, and `~/.kimi-code/skills/`
  Agent Skills. `--project` covers `.kimi-code/mcp.json`, root `AGENTS.md`,
  and `.kimi-code/skills/`.

## 0.30.0

### Minor Changes

- 1c9dd14: Add Kilo Code as the 32nd supported client. User scope migrates the `mcp` key
  inside `~/.config/kilo/kilo.json` (kilo.jsonc/config.json also read, JSONC
  accepted, other config keys preserved on rewrite; `type: local/remote` with
  argv-array `command` + `environment`; native `enabled` flag round-trips),
  `~/.config/kilo/AGENTS.md` global instructions, and `~/.kilo/skills/` Agent
  Skills. `--project` covers `kilo.json`/`.kilo/kilo.json(c)`, root `AGENTS.md`,
  and `.kilo/skills/`.

## 0.29.0

### Minor Changes

- 3c40c42: Add Auggie CLI (Augment Code) as the 31st supported client. User scope
  migrates the `mcpServers` key inside `~/.augment/settings.json` (other
  settings preserved on rewrite; explicit `type` written on import),
  `~/.augment/rules/*.md` user rules as instructions, and `~/.augment/skills/`
  Agent Skills. `--project` covers `.augment/settings.json`, `.augment/rules/`,
  and `.augment/skills/`.

## 0.28.0

### Minor Changes

- 59bab26: Add Qoder CLI (Alibaba) as the 30th supported client. User scope migrates the
  `mcpServers` key inside `~/.qoder/settings.json` (other settings preserved on
  rewrite; explicit `type` written on import; native `ws` servers are skipped
  with a warning), `~/.qoder/AGENTS.md` user memory as instructions, and
  `~/.qoder/skills/` Agent Skills. `--project` covers `.mcp.json` at the project
  root, `AGENTS.md`, and `.qoder/skills/`.

## 0.27.0

### Minor Changes

- 7b8c252: Add CodeBuddy (Tencent) as the 29th supported client. User scope migrates
  `~/.codebuddy/.mcp.json` MCP servers (`mcpServers` + top-level
  `disabledMcpServers` name list for native disabled round-trip; JSONC accepted;
  `~/.codebuddy/mcp.json` and legacy `~/.codebuddy.json` are read/write
  fallbacks), `~/.codebuddy/CODEBUDDY.md` user memory as instructions, and
  `~/.codebuddy/skills/` Agent Skills. `--project` covers `.mcp.json` at the
  project root, `CODEBUDDY.md`, and `.codebuddy/skills/`.

## 0.26.0

### Minor Changes

- 659965f: Add Trae (ByteDance) as the 28th supported client. User scope migrates global
  Agent Skills (`~/.trae/skills/`) — user-level MCP servers, rules, and memories
  are app-managed through the Settings UI and are warned. `--project` covers
  `.trae/mcp.json` (`mcpServers`, no `type` or `disabled` field — needs the
  "Enable Project MCP" toggle, warned), `.trae/rules/*.md`, and `.trae/skills/`.

## 0.25.0

### Minor Changes

- 3f00a9f: Add LM Studio as the 27th supported client: MCP servers in
  `~/.lmstudio/mcp.json` (`mcpServers` map, Cursor-style notation — stdio uses
  `command`/`args`/`env`, remote uses `url`/`headers`, no `type` field; no
  `disabled` flag, warned). System prompts/presets, chats, and models are
  app-managed and are skipped with warnings; no project scope.

## 0.24.0

### Minor Changes

- 71e1831: Add Junie (JetBrains) as the 26th supported client: user-level MCP servers in
  `~/.junie/mcp/mcp.json` (`mcpServers`; entries have no `type` field — stdio
  uses `command`/`args`/`env`, remote uses `url`/`headers`; no `disabled` flag,
  warned), global guidelines in `~/.junie/AGENTS.md`, and `~/.junie/skills/`
  (Agent Skills standard). Project scope covers `.junie/mcp/mcp.json`,
  `.junie/AGENTS.md` (root `AGENTS.md` and legacy `.junie/guidelines.md` are
  read), and `.junie/skills/`. The same files are shared by the JetBrains IDE
  plugin and Junie CLI.

## 0.23.0

### Minor Changes

- be59fec: Add Warp (warp.dev) as the 25th supported client: user-level MCP servers in
  `~/.warp/.mcp.json` (`mcpServers` map — alternate wrapper keys `mcp_servers`/
  `servers` are read and preserved on merge; entries have no `type` field, stdio
  uses `command`/`args`/`env` + `working_directory` mapped to portable `cwd`,
  remote servers are plain `url` entries with auto-negotiated transport; no
  `disabled` flag, warned), and project scope via `.warp/.mcp.json` + `AGENTS.md`
  (legacy `WARP.md` is read). Warp global rules live in Warp Drive (app-managed)
  and skills are app-bundled — those layers are skipped with warnings.

## 0.22.0

### Minor Changes

- 9caa665: Add Amazon Q Developer CLI as the 24th supported client: user-level MCP servers
  in `~/.aws/amazonq/mcp.json` (`mcpServers` map, stdio/http with native
  `disabled` flag; `timeout`/`oauth`/`oauthScopes` warned as client-specific; SSE
  servers are written as `http` since the CLI has no `sse` type), and project
  scope via `.amazonq/mcp.json` + `AmazonQ.md`. Agent JSON files (`cli-agents/`),
  the app-managed `/knowledge` store, and skills have no Q CLI equivalent and are
  skipped with warnings.

## 0.21.0

### Minor Changes

- b904b2c: Add Droid (Factory) as the 23rd supported client: user-level MCP servers in `~/.factory/mcp.json` (`mcpServers` map, stdio/http/sse with native `disabled` flag; `disabledTools`/`timeout`/`connectTimeout`/`oauth` warned as client-specific), personal instructions in `~/.factory/AGENTS.md`, Agent Skills in `~/.factory/skills/`, and project scope via `.factory/mcp.json` + `AGENTS.md` + `.factory/skills/`.

### Patch Changes

- 21ab763: Fix stale README intro (still said six clients; now twenty-two) and add a docs-sync test that fails CI whenever README/website client lists drift from the adapter registry.

## 0.20.0

### Minor Changes

- db1e3fe: New client: Antigravity (Google) — 22nd supported client. Reads/writes the `mcpServers` map in `~/.gemini/config/mcp_config.json` (stdio: `command`/`args`/`env`/`cwd`; remote servers use Antigravity's required `serverUrl` field plus `headers`; native `disabled` flag round-trips as portable `enabled: false`), migrates Agent Skills in `~/.gemini/config/skills/`, and supports project scope (`.agents/mcp_config.json` + `.agents/rules/` + `.agents/skills/`). Client-specific `disabledTools`/`authProviderType`/`oauth` settings are reported as warnings; global rules live in `~/.gemini/GEMINI.md` (shared with Gemini CLI) so the user-scope instructions layer stays owned by the `gemini` client, and the absence of a durable memory store is warned.

## 0.19.0

### Minor Changes

- 90669f9: New client: Crush (Charm) — 21st supported client. Reads/writes the `mcp` map in `~/.config/crush/crush.json` (explicit `type: stdio`/`http`/`sse`; native `disabled` flag round-trips as portable `enabled: false`), migrates Agent Skills in `~/.config/crush/skills/`, and supports project scope (`crush.json`/`.crush.json` + `CRUSH.md` + `.crush/skills/`). Client-specific `disabled_tools`/`timeout` settings, the project-only nature of context files, and the absence of a durable memory store are all reported as warnings.

## 0.18.0

### Minor Changes

- 1c58cba: New client: Continue (continue.dev IDE extensions + `cn` CLI) — 20th supported client. Reads/writes the `mcpServers` list in `~/.continue/config.yaml` (name-keyed merge; remote servers use Continue's explicit `type: streamable-http`/`sse`, imported headers become `requestOptions.headers`), migrates rules markdown in `~/.continue/rules/`, and supports project scope (`.continue/mcpServers/` standalone blocks + `.continue/rules/`). Client-specific `requestOptions`/`connectionTimeout` settings, the missing disabled flag, and the absence of SKILL.md skills or durable memory are all reported as warnings.

## 0.17.0

### Minor Changes

- dc76a5a: New client: Roo Code (`roo`). Migrates MCP servers from the VS Code
  globalStorage `mcp_settings.json` (stdio + streamable-http/sse remotes with
  Roo's required explicit `type`, native `disabled` flag preserved), global
  rules from `~/.roo/rules/` as instructions, and `~/.roo/skills/` Agent
  Skills. Client-specific `alwaysAllow`/`disabledTools`/`timeout`/`watchPaths`
  settings are reported as warnings. Project scope (`--project`) covers
  `.roo/mcp.json`, `.roo/rules/`, and `.roo/skills/`.

## 0.16.0

### Minor Changes

- 87d3407: New client: Kiro (AWS) — `kiro`. Migrates MCP servers from `~/.kiro/settings/mcp.json` (`mcpServers`; stdio `command`/`args`/`env`, remote `url`/`headers`, native `disabled` flag), steering markdown from `~/.kiro/steering/` as instructions (AGENTS.md standard supported), and `~/.kiro/skills/` (Agent Skills standard) — in both directions, with merge-by-default MCP import and secret redaction. `autoApprove`/`disabledTools`/`oauth` settings are client-specific and reported as warnings. Project scope (`--project`) covers `.kiro/settings/mcp.json`, `.kiro/steering/`, and `.kiro/skills/`.

## 0.15.0

### Minor Changes

- 4fc102f: New client: VS Code (`vscode`, Copilot agent mode). Migrates MCP servers from
  the user-profile `mcp.json` (`servers` map; stdio `command`/`args`/`env`,
  remote `type: http`/`sse` + `url`/`headers`), checking all three platform
  profile folders and writing back to the existing file or the current
  platform's default. `inputs` placeholders are preserved untouched; `envFile`
  references are dropped with a warning. Project scope via `--project`
  (`.vscode/mcp.json` + `.github/copilot-instructions.md`).

## 0.14.0

### Minor Changes

- f6e6044: New client: Claude Desktop (`claude-desktop`). Migrates MCP servers from
  `claude_desktop_config.json`, checking all three platform locations
  (`~/Library/Application Support/Claude` on macOS, `%APPDATA%\Claude` on
  Windows, `~/.config/Claude` on Linux) and writing back to the existing file
  or the current platform's default. Instructions, memory, and projects are
  app-managed in Claude Desktop and are skipped with warnings.

## 0.13.0

### Minor Changes

- fcb8be1: New client: Amp (`amp`, by Sourcegraph). Migrates MCP servers from the
  `amp.mcpServers` key of `~/.config/amp/settings.json` (local
  `command`/`args`/`env`, remote `url`/`headers`), global instructions from
  `~/.config/amp/AGENTS.md`, and skills from the `~/.agents/skills/` standard
  location. Project scope via `--project` (workspace `.amp/settings.json`
  servers — flagged as requiring `amp mcp approve` — plus `AGENTS.md` and
  `.agents/skills/`).

## 0.12.0

### Minor Changes

- 85a0869: New client: goose (`goose`, by Block). Migrates MCP servers from the
  `extensions` key of `~/.config/goose/config.yaml` (stdio `cmd`/`args`/`envs`,
  remote `streamable_http`/`sse` with `uri`; builtin/platform extensions are
  goose-internal and skipped), global instructions from
  `~/.config/goose/.goosehints`, durable memories from the memory extension's
  `~/.config/goose/memory/*.txt` files, and skills from the `~/.agents/skills/`
  standard location. Project scope via `--project` (`.goosehints`,
  `.goose/memory/`, `.agents/skills/`; goose extensions are user-scoped only).

## 0.11.0

### Minor Changes

- a41e0bb: New client: Qwen Code (`qwen`). Migrates MCP servers from
  `~/.qwen/settings.json` (`mcpServers`; remote `url`/`httpUrl` both accepted),
  instructions and saved memories from `~/.qwen/QWEN.md` (the "Qwen Added
  Memories" section round-trips as the memory layer), and native SKILL.md
  skills (`~/.qwen/skills/`). Project scope via `--project`
  (`.qwen/settings.json` + `QWEN.md` + `.qwen/skills`). Also: `httpUrl`
  (Gemini CLI / Qwen streamable-HTTP spelling) is now recognized when parsing
  MCP entries everywhere.

## 0.10.0

### Minor Changes

- ff70719: New client: OpenCode (`opencode`). Migrates MCP servers from
  `~/.config/opencode/opencode.json` (`mcp` root; `type: local` with argv
  `command` arrays + `environment`, `type: remote`, `enabled` flags all
  normalized), instructions (`~/.config/opencode/AGENTS.md`), and native
  SKILL.md skills (`~/.config/opencode/skills/`). Project scope via
  `--project` (`opencode.json` + `AGENTS.md` + `.opencode/skills`).

## 0.9.0

### Minor Changes

- 2eb73b7: New client: GitHub Copilot CLI (`copilot`). Migrates user-level MCP servers
  (`~/.copilot/mcp-config.json`, `type: local` normalized to stdio) and user
  instructions (`~/.copilot/copilot-instructions.md` + `~/.copilot/instructions/`),
  plus project scope via `--project` (`.mcp.json` + `.github/copilot-instructions.md`
  - `.github/instructions/`). Client-specific `tools` allowlists and the missing
    disabled flag are reported as warnings, never dropped silently.

### Patch Changes

- 2206de7: `agentmove clients` table output now sizes its columns dynamically, so long
  labels (e.g. "OpenAI Codex CLI") no longer break the path column alignment.

## 0.8.1

### Patch Changes

- 5febb57: CLI UX polish benchmarked against gh/pnpm: mistyped commands and options now
  exit with the documented usage code (2) instead of 1; unknown clients suggest
  the nearest match ("did you mean \"gemini\"?"); `--help` gains an Examples
  section and a docs link.

## 0.8.0

### Minor Changes

- 87cefd6: Encrypted bundle transport: new `pack <bundle> [-o file]` and
  `unpack <file> [-o dir]` commands turn a bundle into a single portable
  `.agentpack` file encrypted with AES-256-GCM (key derived from the
  `AGENTMOVE_PASSPHRASE` environment variable via scrypt), so an agent can be
  carried across machines through untrusted channels. `import -i` accepts an
  `.agentpack` file directly. Missing passphrase is a usage error (exit 2);
  wrong passphrase or a tampered file fails authentication (exit 3).

## 0.7.0

### Minor Changes

- 4988eb8: New client: OpenHands (`openhands`). Migrates MCP servers via the `[mcp]`
  section of `~/.openhands/config.toml` (transport-specific `stdio_servers`,
  `shttp_servers`, and `sse_servers` lists; string-or-object remote entries;
  Bearer Authorization headers mapped to `api_key`, other headers dropped with a
  warning) and user microagents (`~/.openhands/microagents/*.md`) as the
  instructions layer. `--project` migrates `.openhands/microagents/` and
  `.openhands/skills/` (SKILL.md directories). Per-server `timeout` and
  conversation state are not portable — warned.

## 0.6.0

### Minor Changes

- 82fb721: New client: Zed (`zed`). Migrates MCP servers via the `context_servers` key of
  `~/.config/zed/settings.json` (JSONC parsed; unrelated settings preserved on
  merge; stdio servers always emitted with `args`, which Zed's schema requires)
  and personal instructions via `~/.config/zed/AGENTS.md`. `--project` migrates
  `.zed/settings.json` and `.rules`. Zed Rules Library / Skills are app-managed
  and not migrated; JSONC comments are not preserved on rewrite — both warned.

## 0.5.0

### Minor Changes

- 6ed683b: New client: Cline (`cline`). Migrates MCP servers via
  `~/.cline/data/settings/cline_mcp_settings.json` (remote transports normalized
  between Cline's `type: streamableHttp`/`sse` and the portable model, `disabled`
  flag mapped to the portable enabled state) and global rules via
  `~/Documents/Cline/Rules/*.md` (instructions layer). `--project` migrates
  `.clinerules/*.md`. The VS Code extension's own MCP settings copy in VS Code
  globalStorage is not touched; skills have no Cline equivalent — skipped with
  warnings.

### Patch Changes

- b2d3710: A memory/instructions-only import (e.g. `--only memory` or `--mif`) no longer
  rewrites the target client's MCP/config file when the import brings no MCP
  servers, no `--replace-mcp`, and no model change — the file is now left
  completely untouched instead of being re-serialized.

## 0.4.0

### Minor Changes

- 18111c7: New client: Windsurf (`windsurf`). Migrates MCP servers via
  `~/.codeium/windsurf/mcp_config.json` (remote servers normalized between
  `serverUrl` and the portable `url`) and global rules via
  `~/.codeium/windsurf/memories/global_rules.md` (instructions layer).
  `--project` migrates `.windsurf/rules/*.md`. Cascade memories are app-managed
  and cannot be migrated; skills have no Windsurf equivalent — both are skipped
  with warnings.
- d0f7f55: Memory interchange via MIF v2: `export --mif <file>` writes the memory layer
  as a vendor-neutral MIF document, and `import <client> --mif <file>` imports
  memories from a MIF document instead of a bundle. Non-portable MIF fields
  (embeddings, knowledge-graph data) are dropped with warnings; non-MIF input
  is a data error (exit 3).

## 0.3.0

### Minor Changes

- 7b0c883: Project-scoped migration: `export`/`import`/`convert` accept `--project <dir>`
  to migrate a repository's client files instead of user-scoped config —
  `.mcp.json`/`CLAUDE.md`/`.claude/skills` (claude-code), `AGENTS.md`/`.agents/skills`
  (codex), `.gemini/settings.json`/`GEMINI.md` (gemini), and
  `.cursor/mcp.json`/`.cursor/rules/*.mdc` (cursor). MCP merge semantics, secret
  redaction, dry-run, and backups (to `<dir>/.agentmove/backups`) work the same
  as user-scoped migration. OpenClaw/Hermes have no project scope (usage error).

## 0.2.2

### Patch Changes

- 86b86e6: `export` now removes bundle-owned files (manifest, config, mcp-servers,
  instructions, persona, memory/, skills/) from the output directory before
  writing, so re-exporting into the same directory (especially with `--only`)
  no longer leaves stale layers behind. Files agentmove does not own are left
  untouched.

## 0.2.1

### Patch Changes

- ce5a79e: Security: `Authorization` and `Cookie`-style MCP headers are now redacted to
  `${VAR}` placeholders on export by default (previously only names matching
  key/token/secret/password/credential were). Use `--include-secrets` to keep
  real values.

## 0.2.0

### Minor Changes

- 7cd2482: Partial migration: `export`, `import`, and `convert` accept `--only <layers>`
  (comma-separated subset of `mcp`, `skills`, `memory`, `instructions`,
  `persona`) to migrate just the layers you ask for. Unknown layer names fail
  with exit code 2. Shell completion and the man page cover the new flag.

## 0.1.2

### Patch Changes

- b3fcb92: Fix the shipped man page never being linked by npm: npm only links man files
  whose basename matches the package name, so `man/agentmove.1` is renamed to
  `man/agentmove-cli.1`. After a global install, `man agentmove-cli` now works.

## 0.1.1

### Patch Changes

- 8748781: Maturity wave: real-environment e2e tests for the built CLI, coverage gate in CI, governance files, and honest memory/persona limitation docs. No behavior changes to the CLI itself.
- 4276a2b: Production-benchmark round 8: global `--debug` flag (or `AGENTMOVE_DEBUG=1`)
  prints a full stack trace on unexpected errors; default output stays a single
  readable line with a hint to rerun with `--debug`.
- 0769894: Production-benchmark round 4: new `agentmove completion <bash|zsh>` command
  generating shell completion for commands, client ids, and flags (enable with
  `eval "$(agentmove completion bash)"`).
- 41b1778: Production-benchmark round 1: imports now merge MCP servers into the target's
  existing list instead of replacing it (opt out with `--replace-mcp`), config
  parse errors include the offending file path, and the CLI follows a documented
  exit-code contract (0 success, 1 unexpected, 2 usage, 3 bad input data).
- ea028fe: Production-benchmark round 7: ship a man page (`man agentmove` after a global
  install) covering all commands, options, exit codes, and files.
- 6c77a04: Production-benchmark round 6: fish shell completion (`agentmove completion
fish`), and `--version` now reads the real package version instead of a
  hardcoded string.
- 0769894: Production-benchmark round 3: new `agentmove clients [--json]` command listing
  supported clients and their default config locations, `export --json` for
  consistency with the other commands, and permission errors (EACCES/EPERM) now
  include remediation guidance.
- 07eb2ef: Production-benchmark round 2: `--json` machine-readable output on
  `import`/`convert`/`diff`/`doctor`, a per-layer `migrated:` summary after
  `--apply`, and Node 20 LTS support (engines lowered to >=20, CI runs a
  Node 20 + 22 matrix).
