# GAP Report — Round 53: CodeBuddy (Tencent) adapter (29th client)

## Why CodeBuddy

- Tencent's CodeBuddy Code CLI is a mainstream Claude-Code-style coding agent
  with a large China + international user base and fully documented file-based
  configuration — a natural fit for agentmove's migration surfaces.
- Candidate iFlow CLI (Alibaba 心流) was rejected: its official docs state
  "iFlow CLI will officially shut down on April 17, 2026 — please migrate to
  Qoder", so it is end-of-life. Qoder CLI (`~/.qoder/settings.json`,
  `.mcp.json`) remains a future candidate.

## Official sources

- https://www.codebuddy.ai/docs/cli/mcp — MCP config files, entry format,
  scopes, env-var expansion, `disabledMcpServers`.
- https://www.codebuddy.cn/docs/cli/codebuddy-dir — `~/.codebuddy/` and
  project `.codebuddy/` directory layouts (CODEBUDDY.md, rules/, skills/,
  agents/, settings.json).

## Verified facts implemented

- User MCP file priority (read first existing; write first existing, else
  create highest priority): `~/.codebuddy/.mcp.json` (recommended) →
  `~/.codebuddy/mcp.json` (deprecated) → `~/.codebuddy.json` (legacy; also
  holds local-scope `projects` blocks, which are preserved on merge).
- Entry format: `type` optional (`stdio`/`sse`/`http`, inferred from
  `command`/`url` when absent; docs recommend explicit `type` — we write it);
  stdio uses `command`/`args`/`env`; remote uses `url`/`headers`;
  `description` is client-specific (warned, not migrated).
- Files may be JSONC (comments + trailing commas) — parsed with JSON5;
  comment loss on rewrite is warned.
- Disabled state: top-level `disabledMcpServers` string array — round-trips
  natively (export marks `enabled:false`; import merges names into the list).
- `cwd` is not documented for CodeBuddy stdio entries — dropped with warning.
- User memory: `~/.codebuddy/CODEBUDDY.md` (instructions slot; persona
  appended, approximated). Auto-memory (`memory.autoMemoryEnabled`) is
  app-managed runtime data — imported memory skipped with warning.
- User rules `~/.codebuddy/rules/*.md` are client-specific rule files with
  frontmatter (`alwaysApply`, `paths`) — left in place, warned on export.
- Skills: `~/.codebuddy/skills/<name>/SKILL.md` (Agent Skills standard).
- Project scope: `.mcp.json` at the project root (recommended; `mcp.json`
  deprecated fallback — same file Claude Code project scope uses),
  `CODEBUDDY.md` (root or `.codebuddy/CODEBUDDY.md`, equivalents per docs),
  `.codebuddy/rules/` (client-specific, warned), `.codebuddy/skills/`.

## Deferred / not implemented

- `~/.codebuddy/agents/` subagents and `.codebuddy/commands/` slash commands
  are CodeBuddy-specific formats with no portable equivalent.
- `settings.json` permissions/plugins are client-specific settings.
- Local scope (`~/.codebuddy.json#/projects/<path>`) entries are preserved
  untouched but not migrated as a scope.

## Testing

- Fixture-only unit tests (`test/codebuddy.test.ts`): export (servers +
  disabled state + memory + skills), merge import with `disabledMcpServers`
  union, `--replace-mcp`, legacy-file write-path selection, project scope
  round-trip.
- Included in the full user-scope e2e conversion matrix (29 clients).
