# agentmove-cli

## 0.76.0

### Minor Changes

- 97f03e2: Commands layer for Kilo Code and Cline: Kilo `~/.config/kilo/commands/` (flat; legacy `~/.kilocode/workflows/` still read, new location wins; project `.kilo/commands/`) and Cline workflows `~/Documents/Cline/Workflows/` (flat, `/name.md` invocation; non-markdown workflow files warned, not migrated; project `.clinerules/workflows/`). Nested bundle names are flattened with a warning; client-specific frontmatter is copied as-is with a warning.

## 0.75.0

### Minor Changes

- bc11a30: Commands layer for Qoder CLI and Roo Code: migrate markdown slash commands to/from Qoder (`~/.qoder/commands/`; project `.qoder/commands/`; nested directories preserved as `/group:command` names) and Roo Code (`~/.roo/commands/`; project `.roo/commands/`; flat — nested names are flattened with a warning). Frontmatter is copied as-is with client-specific warnings.

## 0.74.0

### Minor Changes

- 7e5eb70: Commands layer for CodeBuddy and Droid (Factory): migrate markdown slash commands to/from CodeBuddy (`~/.codebuddy/commands/`; project `.codebuddy/commands/`; nested directories preserved as `/group:command` names) and Droid (`~/.factory/commands/`; project `.factory/commands/`; nested directories preserved). Droid shebang script commands are warned per file and not migrated; frontmatter and argument placeholders are copied as-is with client-specific warnings.

## 0.73.0

### Minor Changes

- df2d45a: Commands layer for Windsurf and Amazon Q Developer CLI: migrate markdown slash commands to/from Windsurf workflows (`~/.codeium/windsurf/global_workflows/`; project `.windsurf/workflows/`) and Amazon Q saved prompts (`~/.aws/amazonq/prompts/`; project `.amazonq/prompts/`). Both are flat-scan clients — nested command names are flattened with a warning; Windsurf commands over the 12000-character workflow limit are written as-is with a warning.

## 0.72.0

### Minor Changes

- 50e7104: Commands layer for OpenCode and Qwen Code: migrate markdown slash commands to/from OpenCode (`~/.config/opencode/commands/`; project `.opencode/commands/`) and Qwen Code (`~/.qwen/commands/`; project `.qwen/commands/`), with nested subdirectory names preserved byte-faithfully. Qwen's deprecated TOML command files are warned per file on export (not migrated); client-specific frontmatter and argument placeholders are warned as usual.

## 0.71.0

### Minor Changes

- 76f114b: New portable "commands" layer: migrate Markdown slash commands / custom prompts between Claude Code (`~/.claude/commands/`, nested names preserved; project `.claude/commands/`), Cursor (`~/.cursor/commands/`; project `.cursor/commands/`), and Codex CLI (`~/.codex/prompts/`, deprecated in favor of skills but still supported). Content is byte-faithful; client-specific frontmatter and argument placeholders are warned; flat-scan targets flatten nested names with a warning; `--only commands`, `diff`, and `doctor` support included.

## 0.70.0

### Minor Changes

- 28d7328: Custom agents layer for Kimi Code CLI: migrate custom agent markdown
  definitions recursively from `~/.kimi-code/agents/` and the shared
  `~/.agents/agents/` root (user; brand dir wins name conflicts) and
  `.kimi-code/agents/` + `.agents/agents/` (project, with `--project`)
  byte-faithfully, preserving subdirectory paths; imports write only the
  brand-native `.kimi-code/agents/` directory, with an honest warning that
  `tools`/`disallowedTools`/`subagents`/`model_preference`/`override`
  frontmatter is client-specific.

## 0.69.0

### Minor Changes

- 407b8db: Custom agents layer for Qoder CLI: migrate custom subagent markdown
  definitions in `~/.qoder/agents/` (user) and `.qoder/agents/` (project, with
  `--project`) byte-faithfully, with an honest warning that
  `tools`/`model`/`skills`/`mcpServers` frontmatter is client-specific.

## 0.68.0

### Minor Changes

- 99afe52: Custom agents layer for CodeBuddy: migrate custom sub-agent markdown
  definitions in `~/.codebuddy/agents/` (user) and `.codebuddy/agents/`
  (project, with `--project`) byte-faithfully, with an honest warning that
  `tools`/`model`/`effort`/`maxTurns`/`memory`/`mcpServers` frontmatter is
  client-specific.

## 0.67.0

### Minor Changes

- 6040236: Custom agents layer for Droid (Factory): migrate custom droid markdown
  definitions in `~/.factory/droids/` (personal) and `.factory/droids/`
  (project, with `--project`) byte-faithfully, with an honest warning that
  `tools`/`model`/`reasoningEffort`/`mcpServers` frontmatter is client-specific.

## 0.66.0

### Minor Changes

- a9c544c: Custom agents layer for Kiro: migrate markdown agent definitions in
  `~/.kiro/agents/` (user) and `.kiro/agents/` (project, with `--project`)
  byte-faithfully, with honest warnings that `tools`/`model`/`permissions`
  frontmatter is client-specific and that JSON-format agent configs are not
  migrated.

## 0.65.0

### Minor Changes

- 4855d23: Custom agents layer for Cursor: migrate subagent markdown definitions in
  `~/.cursor/agents/` (user) and `.cursor/agents/` (project, with `--project`)
  byte-faithfully, with an honest warning that `model`/`read_only`/`is_background`
  frontmatter is client-specific.

## 0.64.0

### Minor Changes

- 2831047: Custom agents (subagents) support for OpenCode and Qwen Code: user scope `~/.config/opencode/agents/` (legacy `agent/` also read) and `~/.qwen/agents/`, project scope `.opencode/agents/` and `.qwen/agents/`. Markdown and YAML frontmatter are copied byte-faithfully with honest client-specific-field warnings.

## 0.63.0

### Minor Changes

- fb1f99a: Portable custom agents (subagents) layer: migrate agent markdown definitions between Claude Code (`~/.claude/agents/`, project `.claude/agents/`), GitHub Copilot CLI (`~/.copilot/agents/*.agent.md`, project `.github/agents/`), and Gemini CLI (`~/.gemini/agents/`, project `.gemini/agents/`, experimental but enabled by default). Content round-trips byte-for-byte with honest warnings for client-specific frontmatter fields; other clients skip the layer with a warning. New `agents` value for `--only`; `diff` and `doctor` report the layer.

## 0.62.0

### Minor Changes

- 4e393e3: Gemini CLI now migrates Agent Skills: user-level skills in `~/.gemini/skills/`
  (the CLI's native skills directory; `~/.agents/skills/` is a built-in alias)
  and project-level skills in `.gemini/skills/` with `--project`. The stale
  "Gemini CLI has no SKILL.md mechanism" skip warning is removed. Xcode's
  bundled Gemini agent is unchanged (skills support there is undocumented).

## 0.61.0

### Minor Changes

- e6b9abb: New client: Cortex Code (Snowflake CoCo) — `cortex`. Migrates
  `~/.snowflake/cortex/mcp.json` MCP servers (explicit `type: stdio/http/sse`,
  stdio `command`/`args`/`env`/`cwd`, remote `url`/`headers`; the per-server
  `timeout` is client-specific and warned), `~/.snowflake/cortex/AGENTS.md` user
  instructions, and `~/.snowflake/cortex/skills/` Agent Skills. `--project`
  covers `.cortex/mcp.json`, root `AGENTS.md`, and `.cortex/skills/`.
  Agent-managed memory under `~/.snowflake/cortex/memory/` is honestly skipped
  with a warning.

## 0.60.0

### Minor Changes

- 1bc6197: Skills repository import now understands the namespaced
  `skills/<scope>/<name>/SKILL.md` layout used by `gh skill install` and large
  community repositories like `github/awesome-copilot` — namespaced and direct
  `skills/<name>/` entries can be mixed in one repository. On a skill-name clash
  across namespaces the later skill is imported as `<scope>-<name>` with an
  honest warning; hidden directories are skipped.

## 0.59.1

### Patch Changes

- 85b888c: `export --skills-repo` now strips `gh skill install` source-tracking metadata
  (the `metadata.github-*` frontmatter keys the GitHub CLI injects on install)
  from each `SKILL.md`, with a warning per affected skill — mirroring
  `gh skill publish --fix`, so the exported repository passes
  `gh skill publish` validation directly. All other frontmatter keys and file
  contents remain byte-identical.

## 0.59.0

### Minor Changes

- c05d7f2: Skills repository export: `export <client> --skills-repo <dir>` also writes the
  skills layer as a skills repository in the conventional
  `skills/<name>/SKILL.md` layout — ready to commit and publish with
  `gh skill publish`, install with `npx skills add`, or import back with
  `agentmove import -i`. A path ending in `.zip`/`.tgz`/`.tar.gz` writes it as an
  archive; exporting a client with no skills is a data error (exit 3).

## 0.58.0

### Minor Changes

- 7cd80c5: Plugin archive export: `export <client> --plugin -o <file>.zip` (or `.tgz` /
  `.tar.gz`) packages the Agent Plugin as a ready-to-publish archive — e.g. a
  GitHub release asset — instead of a directory. The plugin name is the filename
  without the archive suffix; contents are identical to the directory form and
  round-trip through the existing archive import.

## 0.57.0

### Minor Changes

- 8a2a0a9: Archive import: `import <client> -i <file-or-url>` now accepts `.zip`, `.tgz`,
  and `.tar.gz` archives — GitHub release assets, repository "Download ZIP"
  links, or local files. The archive is downloaded (for URLs) and extracted, a
  single top-level wrapper directory is unwrapped, and the contents go through
  the existing auto-detection (Agent Plugin, agentmove bundle, skills
  repository, standalone mcp.json). Corrupt archives are a data error (exit 3).

## 0.56.0

### Minor Changes

- 3dafd55: URL import polish: GitLab-style `/-/tree/<branch>[/<dir>]` URLs are recognized
  (the `/-/` marker supports arbitrarily nested subgroups), and a pasted GitHub /
  GitLab `blob` link to a `.json` file is rewritten to the raw file it renders
  (`github.com/o/r/blob/…` → `raw.githubusercontent.com/…`, `/-/blob/` → `/-/raw/`)
  so it imports as a config instead of failing on the HTML page.

## 0.55.0

### Minor Changes

- de72e72: Tree URL import: `import <client> -i https://…/tree/<branch>[/<dir>]` clones the
  repository at that branch and imports just that directory — e.g. a single skill
  out of a many-skill repository (`…/agent-skills/tree/main/skills/web-design`).
  A missing directory is a data error (exit 3).

## 0.54.0

### Minor Changes

- 1a6c6f9: Skills repository import: `import <client> -i <dir-or-url>` now auto-detects a
  skills repository (the skills.sh / `npx skills add owner/repo` ecosystem) —
  `SKILL.md` directories under `skills/`, at the repository top level, or a single
  root `SKILL.md` (named from its frontmatter) — and installs the skills into any
  client's skills location with the usual dry-run/merge/backup semantics.

## 0.53.0

### Minor Changes

- 4023896: Agent Skills support for Claude Desktop: personal skills migrate via
  `~/.claude/skills/` — the root Claude Desktop local sessions load (shared with
  Claude Code; imports emit a shared-root warning). The old "claude-desktop has
  no SKILL.md mechanism" skip warning is removed.

## 0.52.0

### Minor Changes

- b4bbc6f: URL import: `import <client> -i <url>` now accepts http(s) URLs. A `.json` URL
  is fetched and imported as a standalone MCP config; any other URL is shallow
  `git clone`d and auto-detected as an Agent Plugin or agentmove bundle
  repository. Plain-http URLs emit an insecure-URL warning; fetch/clone failures
  are data errors (exit 3). Teams can now share one hosted mcp.json or plugin
  repo and import it directly into any of the 46 supported clients.

## 0.51.0

### Minor Changes

- 08db890: Agent Skills support for VS Code: personal skills migrate via `~/.agents/skills/`
  (the shared cross-agent root VS Code now scans natively), and project skills via
  `.github/skills/` with `--project`. The old "vscode has no SKILL.md mechanism"
  skip warning is removed.

## 0.50.0

### Minor Changes

- 2694700: Standalone MCP config export: `export <client> --mcp-json <file>` also writes
  the MCP layer as a standalone standard mcp.json (explicit `type` on every
  entry, Agent Plugins MCP schema, secrets redacted by default) — the reverse of
  `import -i mcp.json`, producing a shareable canonical server list for a team or
  any mcpServers-speaking tool. Standalone files keep `cwd`; disabled servers are
  exported as enabled with a warning.

## 0.49.0

### Minor Changes

- 4c8cbeb: Standalone MCP config import: `import <client> -i mcp.json` now accepts any bare `.json` file with an `mcpServers` map (an Agent Plugins mcp.json, a Claude-style .mcp.json, or a canonical team server list) and merges it into any client. Transports come from an explicit `type`/`transport` field or are inferred from `command`/`url` with a warning; unresolvable entries are dropped with a warning.

## 0.48.0

### Minor Changes

- f7da95a: Agent Plugins 1.0.0 interop: `export <client> --plugin` writes a conformant Agent Plugin (plugin.json + skills/ + mcp.json with explicit stdio/streamable-http/sse types), and `import -i <dir>` auto-detects Agent Plugin directories so any plugin from the ecosystem can be imported into all supported clients. Layers with no plugin slot (instructions, persona, memory) and absolute cwd values are skipped with honest warnings.

## 0.47.0

### Minor Changes

- 6ea21af: Codex CLI (and Xcode Codex): full remote-MCP auth field support. `bearer_token_env_var` now exports as an `Authorization: Bearer ${VAR}` placeholder header and `env_http_headers` entries export as `${VAR}` placeholder headers — both are portable across all 46 clients and written back natively when importing into Codex. Per-server client-specific fields (`startup_timeout_sec`, `tool_timeout_sec`, `env_vars`, `enabled_tools`, `disabled_tools`, `default_tools_approval_mode`, `tools`, `auth`, `experimental_environment`) now raise an honest export warning instead of being dropped silently (they were and are preserved on merge). Secret redaction skips values that are already env-var placeholders (`${VAR}` / `Bearer ${VAR}`) and keys that name env vars (`*_env_var(s)`).

## 0.46.0

### Minor Changes

- c577679: New client: Warp Agent CLI (`warp-cli`) — Warp's standalone terminal coding agent (launched 2026-08-04). User scope migrates `~/.warp_cli/.mcp.json` (`mcpServers`, the CLI's own server set separate from the Warp app's), the shared global rules file `~/.agents/AGENTS.md`, and personal Agent Skills in `~/.agents/skills/`. Project scope covers root `AGENTS.md` (or `WARP.md`) rules and `.agents/skills/` — project `.warp/.mcp.json` remains the `warp` client's territory. 46×46 conversion matrix.

## 0.45.1

### Patch Changes

- 67cf583: Security: the raw source-config snapshot kept in the bundle's `config.json` is now redacted recursively by default — likely-secret values (`*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `*AUTHORIZATION*`, `*COOKIE*`) anywhere in the snapshot are replaced with `${VAR}` placeholders, matching the existing MCP-layer redaction. Pass `--include-secrets` to keep literal values.

## 0.45.0

### Minor Changes

- e87ef3c: New client: Muse Code (Meta's terminal coding agent, 45th client) — `~/.config/muse/settings.json` `mcp_servers` (explicit `transport: stdio/streamable_http`, native `enabled` flag, `schema_version: 1` preserved/written) + `~/.config/muse/skills/` Agent Skills; project scope migrates root `AGENTS.md`, `.agents/skills/`, and `.agents/memory/` durable memory.

## 0.44.0

### Minor Changes

- d10c37e: Agent Skills support for Zed (`~/.agents/skills/`, project `.agents/skills/`) and Continue (`~/.continue/skills/`, project `.continue/skills/`): skills now migrate natively in both directions instead of being skipped with a warning.

## 0.43.0

### Minor Changes

- d048d8a: Agent Skills support for Cline (`~/.cline/skills/`, project `.cline/skills/`) and Warp (`~/.warp/skills/`, project `.warp/skills/`): skills now migrate natively in both directions instead of being skipped with a warning.

## 0.42.0

### Minor Changes

- 470f8ee: Agent Skills support for GitHub Copilot CLI (`~/.copilot/skills/`, project `.github/skills/`) and Windsurf (`~/.codeium/windsurf/skills/`, project `.windsurf/skills/`): skills now migrate natively in both directions instead of being skipped with a warning.

## 0.41.0

### Minor Changes

- d3c0862: Cursor now supports the Agent Skills standard (official cursor.com/docs/skills)
  — the cursor adapter migrates skills instead of skipping them: user scope reads
  and writes `~/.cursor/skills/`, project scope (`--project`) reads and writes
  `.cursor/skills/`. The old "cursor has no skills directory" warning is gone.

## 0.40.0

### Minor Changes

- ba28ec3: New client: Baidu Comate (`comate`, 44th client). User scope migrates global
  Agent Skills from `~/.comate/skills/`; MCP servers and rules are
  project-scoped — `--project` covers `.comate/mcp.json` (`mcpServers`,
  merge-by-name; no `type`/`disabled` fields, sse and disabled states warned),
  `.comate/rules/*.mdr` project rules (export merges them into instructions
  with frontmatter kept as-is; import writes
  `.comate/rules/agentmove-imported.mdr` with an `alwaysApply: true`
  frontmatter), and `.comate/skills/`. Chat memory is app-managed under
  `.comate` and skipped with a warning.

## 0.39.0

### Minor Changes

- f1e3cca: New client: JetBrains AI Assistant (`jetbrains`, 43rd client) — user-scoped MCP servers in the shared `~/.ai/mcp/mcp.json` (`mcpServers`; native `workingDirectory` round-trips as `cwd`), project scope `.ai/mcp/mcp.json` + `.aiassistant/rules/*.md` project rules. Prompts and chat memory are IDE-managed (skipped with warnings).

## 0.38.0

### Minor Changes

- 413ad16: New clients: Xcode 26's bundled agents (40th–42nd clients, macOS): `xcode-claude`, `xcode-codex`, and `xcode-gemini` migrate the per-agent config roots under `~/Library/Developer/Xcode/CodingAssistant` (`ClaudeAgentConfig/`, `codex/`, `gemini/`), which are isolated from the standalone CLIs' `~/.claude`/`~/.codex`/`~/.gemini`. File formats, merge semantics, and lossy edges match the corresponding standalone client (Claude Code / Codex CLI / Gemini CLI); `xcode-codex` has no documented skills directory, so imported skills are skipped with a warning. Migrate between a standalone CLI and its Xcode twin with e.g. `agentmove convert claude-code xcode-claude`.

## 0.37.0

### Minor Changes

- 7f51139: New client: LibreChat (`librechat`, 39th client). Project-scoped migration of the deployment's `librechat.yaml` `mcpServers` map (use `--project` in the LibreChat deployment directory): stdio servers use `command`/`args`/`env`, remote servers use `url`/`headers` with explicit `type: sse`/`streamable-http` (an omitted `type` on an http(s) url means SSE); websocket servers are skipped with a warning; `timeout`/`customUserVars`/`oauth` and other client-specific keys are warned and preserved on merge; all other YAML keys are preserved on rewrite. Custom prompts, agents, and memory are app-managed (database) and skipped with honest warnings.

## 0.36.0

### Minor Changes

- e342a88: New client: AnythingLLM (`anythingllm`) — migrate MCP servers to and from
  `~/.config/anythingllm-desktop/storage/plugins/anythingllm_mcp_servers.json`
  (stdio command/args/env; remote url/headers with `streamable`/`sse` types;
  `anythingllm.autoStart: false` round-trips as the disabled flag).

## 0.35.0

### Minor Changes

- 0ec3ac6: Jan adapter (37th client): `~/.local/share/Jan/data/mcp_config.json` `mcpServers` map — every entry carries `command`/`args` (empty for remote servers), remote entries use `type` (`http`/`sse`) plus `url`/`headers`, the native `active` flag round-trips as enabled, `timeout`/`official` warned as client-specific and preserved on merge, and `mcpSettings`/other top-level keys are preserved on rewrite. Assistants, models, and chats are app-managed and skipped with warnings.

## 0.34.0

### Minor Changes

- e7cfd59: Nanocoder adapter (36th client): `~/.config/nanocoder/.mcp.json` `mcpServers` map with explicit `transport` (stdio/http; websocket skipped with a warning), `enabled` flag round-trip, `timeout`/`alwaysAllow`/`description`/`tags` warned as client-specific and preserved on merge; project scope covers `.mcp.json` and the root `AGENTS.md`. Nanocoder skills use their own skill.yaml bundle format and are skipped with a warning.

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
