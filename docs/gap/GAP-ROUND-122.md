# GAP-ROUND-122: Codex CLI custom agents (agent role TOML files)

## Official sources

- https://developers.openai.com/codex/subagents — custom agents live in
  `~/.codex/agents/` (user) and `.codex/agents/` (project); each is a
  standalone TOML file with required `name`, `description`,
  `developer_instructions` and optional model/reasoning/sandbox/MCP/skills
  settings; global `[agents]` config controls enablement and defaults.
- openai/codex source, `codex-rs/core/src/config/agent_roles.rs`:
  - `collect_agent_role_files` walks the `agents/` folder of every config
    layer **recursively** and collects every `*.toml` file (paths sorted).
  - `parse_agent_role_file_contents` requires a non-empty `name` (the role
    name comes from the file's `name` field, not the filename/path), a
    non-blank `description`, and non-blank `developer_instructions` for
    discovered files; malformed files produce a startup warning and are
    ignored.
  - Duplicate role names within a layer keep the first file found (sorted
    path order) and warn.
  - Remaining TOML keys form a config layer for the spawned session
    (`model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`,
    `nickname_candidates`, skills config, …).
  - Roles can also be declared inline under `[agents.<name>]` in
    `config.toml` (optionally pointing at a `config_file`).

## Mapping decisions

- Export converts each role file to a portable agent: `name` field →
  portable name, `description` → frontmatter, `developer_instructions` →
  body. All other settings are dropped with per-field warnings (no
  portable equivalent).
- Files missing `name`, `description`, or `developer_instructions` are
  warned and not migrated — Codex itself rejects them.
- Duplicate role names: first file (sorted path order) wins, warned —
  matching upstream.
- Import writes `name` + `description` + `developer_instructions` TOML
  into `~/.codex/agents/<name>.toml` (project: `.codex/agents/`). Nested
  portable names are flattened (`backend/sql` → `backend-sql`, warned;
  post-flatten collisions skipped with a warning). A missing description
  is synthesized; frontmatter beyond `description` is kept verbatim
  inside `developer_instructions` (warned).

## Deferred (honestly documented)

- Inline `[agents.<name>]` roles in `config.toml` (incl. `config_file`
  indirection) are not migrated; only standalone files under `agents/`
  are covered.
- Global `[agents]` settings (`enabled`, thread limits, default subagent
  model/reasoning, `interrupt_message`) are client configuration, not
  portable agent content.
- Xcode's bundled Codex (`xcode-codex`) uses its own config root and may
  lag the standalone CLI; custom agents are not enabled for it until its
  bundled version's support is verified.
