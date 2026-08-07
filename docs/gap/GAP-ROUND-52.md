# GAP-ROUND-52 — Trae (ByteDance) adapter (28th client)

## Why Trae

Trae (trae.ai, ByteDance) is a mainstream VS Code-based AI IDE with a large
user base (notably in China via Trae CN). It supports MCP, project rules, and
the open Agent Skills standard — all high-value migration targets. It was
deferred in ROUND-48 because project MCP was still marked experimental; the
official docs now document it as a first-class feature.

## Official sources

- https://docs.trae.ai/ide/add-mcp-servers — project-level MCP
  (`.trae/mcp.json`, `mcpServers` root key; stdio uses `command`/`args`/`env`,
  remote uses `url`/`headers`; no `type` or `disabled` field; requires the
  "Enable Project MCP" toggle in Settings > MCP; `${workspaceFolder}` variable
  supported).
- https://docs.trae.ai/ide/rules — project rules under `.trae/rules/*.md`
  (Markdown with optional `alwaysApply`/`description`/`globs` frontmatter,
  read recursively up to three levels); global rules are managed via the
  Settings UI.
- https://docs.trae.ai/ide/skills — skills follow the Agent Skills standard:
  project skills in `.trae/skills/`, global skills in `~/.trae/skills/`
  (Windows `%USERPROFILE%/.trae/skills`); `.agents/skills/` is also read.

## Decisions

- **User scope is skills-only.** User-level MCP servers, global rules, and
  memories are app-managed through the Settings UI; third-party sources
  disagree on the storage location (some claim
  `~/Library/Application Support/Trae/User/mcp.json`) and nothing official
  documents it, so we do not guess — exports/imports warn and point to
  `--project`.
- **Project scope is the primary surface**: `.trae/mcp.json` (merge/replace
  semantics, no `type` written, disabled/SSE warned, Enable Project MCP
  toggle warned), `.trae/rules/agentmove-imported.md` for imported
  instructions/persona, `.trae/skills/` for skills.
- **Excluded from the user-scope 27×27 e2e matrix** (exports carry no MCP
  servers at user scope); covered by dedicated unit/project tests instead.
- `cwd` is not documented for Trae MCP entries — dropped with a warning.

## Deferred

- User-level MCP file support, if ByteDance ever documents a stable location.
- Trae CN (`~/.trae-cn`) variant paths.
