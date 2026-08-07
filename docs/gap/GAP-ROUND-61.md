# GAP-ROUND-61: Jan adapter (37th client)

## Candidate selection

- **Jan (janhq/jan)** — local-first LLM desktop app (~40k GitHub stars),
  ships MCP support with a user-editable `mcp_config.json` in the Jan data
  folder. Chosen: large user base, documented file format, verified against
  the active Rust source.
- **Competitor scan this round**: found three MCP-config sync tools —
  `mcp-sync` (justinclayton), `add-mcp` (neon-solutions, 16 agents), and
  `@agents-dev/cli` (11 integrations). All are MCP-only; none migrate skills,
  memory, or persona. `add-mcp`'s agent list is a subset of AgentMove's
  clients plus `mcporter` (an MCP runner, not a coding agent — not a
  candidate). AgentMove remains the only multi-layer migrator.

## Verified facts (source: janhq/jan @ dev, src-tauri/src/core/mcp/)

- Config file: `<jan-data-folder>/mcp_config.json`. Default data folder is
  `<platform data dir>/Jan/data` — Linux `~/.local/share/Jan/data`, macOS
  `~/Library/Application Support/Jan/data`, Windows `%APPDATA%/Jan/data`
  (`default_data_folder_path` in `core/app/commands.rs`). Relocatable via
  Settings > General (stored in the app configuration file).
- Shape: top-level `mcpServers` map plus `mcpSettings` (runtime knobs:
  `toolCallTimeoutSeconds`, restart backoff, tool routing). Fresh installs
  get `{"mcpServers": {}, "mcpSettings": {}}` (`load_or_create_mcp_config`).
- Entry schema (`extract_command_args` in `helpers.rs`): `command` (string,
  **required**), `args` (array, **required**), `env`, `type`
  (`"http"`/`"sse"`; anything else runs as a stdio child process), `url`,
  `headers`, `timeout` (seconds), `active` (bool — servers with
  `active: false` are not started). The Jan UI writes remote entries with
  `"command": ""` and `"args": []`.
- Default config ships six inactive stdio servers; `official: true` marks the
  bundled Jan Browser MCP.
- Assistant instructions live in `assistants/<id>/assistant.json`
  (`instructions` field) — app-managed alongside models/threads; not a safe
  migration target.

## Adapter decisions

- User scope only: `~/.local/share/Jan/data/mcp_config.json` (Linux default,
  home-relative like all other adapters). No project scope (desktop app).
- Always emit `command`/`args` keys (empty for remote entries) so Jan's
  loader accepts every written entry.
- `active: false` ↔ bundle `enabled: false` round-trip.
- `timeout`/`official` warned as client-specific, preserved on merge.
- `cwd` dropped with a warning; sse imported/exported natively via `type`.
- instructions/persona/memory/skills: skip with warnings.

## Deferred

- macOS/Windows data-dir defaults and relocated data folders (would need a
  platform-path or `--path` mechanism shared with other adapters).
- Writing assistant instructions into `assistants/jan/assistant.json`
  (app-managed; risk of clobbering user assistants).
