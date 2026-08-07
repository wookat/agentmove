# GAP Report — Round 54

## Improvement chosen

Add **Qoder CLI** (Alibaba) as the 30th supported client.

## Why Qoder

- iFlow CLI (rejected in Round 53) officially shuts down 2026-04-17 and its
  shutdown notice tells users to **migrate to Qoder** — making Qoder the
  natural landing spot for an entire user base that needs a migration tool
  right now.
- Qoder CLI has complete official documentation for MCP servers, memory
  (AGENTS.md + rules), skills (Agent Skills standard), and configuration
  scopes — no guessing required.

## Official sources

- https://docs.qoder.com/cli/mcp-servers — MCP scopes and storage files
- https://docs.qoder.com/cli/qoder-directory — configuration scope and
  `.qoder/` directory structure
- https://docs.qoder.com/cli/memory — AGENTS.md locations and rules
- https://docs.qoder.com/cli/Skills — `~/.qoder/skills/{name}/SKILL.md` and
  project `.qoder/skills/`
- https://docs.qoder.com/en/cli/sdk/mcp — server entry shapes
  (`type?: stdio|sse|http|ws`, `command/args/env`, `url/headers`, `isProxy`)

## Verified facts

- User MCP servers live under the `mcpServers` key of `~/.qoder/settings.json`
  — a general settings file whose other keys (theme, permissions,
  `mcp.allowed`/`mcp.excluded`, …) must be preserved on rewrite.
- Project-shared MCP servers live in `<project>/.mcp.json` (committable);
  local project overrides in `.qoder/settings.local.json` (not committed,
  not migrated — machine-private by design).
- Entry shape: `type` optional (stdio default) with `stdio`/`sse`/`http`/`ws`;
  stdio uses `command`/`args`/`env`; remote uses `url`/`headers`; `isProxy`
  is client-specific. No per-server disabled flag — only `mcp.allowed`/
  `mcp.excluded` allowlists (preserved as plain settings).
- User memory: `~/.qoder/AGENTS.md`; project memory: `AGENTS.md` +
  `AGENTS.local.md`; rules split into `rules/**/*.md` (frontmatter-driven
  activation — client-specific, left in place with a warning).
- Auto-Memory is app-managed markdown saved by Qoder itself — skipped with
  a warning (portable via `--mif`).
- Skills: `~/.qoder/skills/{name}/SKILL.md` (user) and `.qoder/skills/`
  (project) — open Agent Skills standard, direct migration.

## Lossy edges (all warned)

- `ws` (WebSocket) servers have no portable equivalent — skipped on export.
- No disabled flag — portable `enabled: false` emitted as enabled.
- `cwd` undocumented — dropped.
- `isProxy` client-specific — not migrated.
- Persona has no native slot — appended to AGENTS.md (approximated).
- User/project rule files are client-specific (frontmatter triggers) — left
  in place, not exported.

## Deferred

- Qoder local project scope (`.qoder/settings.local.json`) — machine-private
  by design; not migrated.
- Qoder plugins, hooks, permissions, scheduled tasks, worktrees — client
  runtime data, out of scope.
