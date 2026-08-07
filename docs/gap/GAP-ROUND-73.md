# GAP-ROUND-73: Muse Code (Meta) — 45th client

## Trigger

Meta released **Muse Code** (beta), a terminal coding agent built on Muse
Spark 1.2, on 2026-08-05 (research.meta.ai blog "Introducing Muse Code and
Muse Spark 1.2"). It is an official first-party harness with documented,
stable, file-based configuration — a prime migration target/source.

## Official evidence (dev.meta.ai)

- Overview: https://dev.meta.ai/docs/muse-code.md — install, first run,
  interactive vs `muse exec` headless.
- Configuration: https://dev.meta.ai/docs/muse-code/configuration.md
  - User settings: `~/.config/muse/settings.json`; **must** carry
    `"schema_version": 1` (a file without it fails every command with
    `malformed settings file`). A missing file is fine (defaults apply).
  - Project rules: root `AGENTS.md` (`muse init`); loader walks up to the
    nearest `.git` boundary and prefers `AGENTS.md` over `CLAUDE.md`.
  - Memory: three scopes — personal project memory and personal memory are
    stored **outside the repo at undocumented app-managed paths**; project
    memory is committed under `.agents/memory/` (`MEMORY.md` index + one
    Markdown file per topic, index injected at session start).
- Extending: https://dev.meta.ai/docs/muse-code/extending.md
  - MCP: `mcp_servers` block of settings.json. Each entry takes a
    `transport`: `stdio` (`command`, `args`, `env`) or `streamable_http`
    (`url`, `headers`), plus `enabled`, `mode` (`required`/`optional` —
    a failing required server aborts the run), and optional `framing`.
  - Skills: user skills in `$XDG_CONFIG_HOME/muse/skills` (and the shared
    `~/.agents/skills`); project skills in `.agents/skills/<name>/SKILL.md`
    (Muse also scans repo-local `.codex/skills` and `.claude/skills`).

## Mapping decisions

- User scope: `~/.config/muse/settings.json` `mcp_servers` (merge-by-name;
  preserve `schema_version`, `mode`, `framing`, and all other settings keys;
  write `schema_version: 1` on fresh files) + `~/.config/muse/skills/`
  (Muse-specific dir chosen over shared `~/.agents/skills` so exports
  attribute skills to Muse).
- `enabled: false` round-trips natively. `mode`/`framing` are
  client-specific → warning, preserved on merge. No SSE transport → portable
  `sse` written as `streamable_http` with a warning. No `cwd` field →
  dropped with a warning.
- Machine-wide user rules and personal memory have no documented file paths
  → skipped with warnings at user scope.
- Project scope: root `AGENTS.md` (persona approximated), `.agents/skills/`,
  and `.agents/memory/` (export reads `MEMORY.md` + topic files; import
  writes `.agents/memory/agentmove.md` with a warning to index it in
  `MEMORY.md`). MCP is user-scoped only → warning at project scope.

## Deferred candidates

- **MCP 2026-07-28 stateless spec**: transport-level change in the protocol,
  not in client config file formats — no adapter impact yet; revisit if
  clients add new transport spellings.
