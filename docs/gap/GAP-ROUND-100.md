# GAP ROUND-100 — Custom agents layer for Qoder CLI

## Evidence (official docs)

- https://docs.qoder.com/cli/subagent — Qoder CLI Subagents are markdown files
  with YAML frontmatter. User scope `~/.qoder/agents/*.md`, project scope
  `.qoder/agents/*.md`. Source priority (low→high): Built-in < User < Project
  < Plugin < `--agents` JSON flag.
- https://docs.qoder.com/extensions/subagent — same file locations for the
  Qoder IDE Custom Agents; documented frontmatter: `name` (required),
  `description` (required), `model`, `tools`, `skills`, `mcpServers`
  (the latter two are allowlists of skill / MCP server names).

## Not migrated (honest)

- Built-in subagents ship with the CLI — nothing on disk to migrate.
- Plugin-provided subagents live inside plugin packages — out of scope.
- `--agents` JSON flag definitions are session-only — nothing to migrate.

## Also researched this round

- Kimi Code CLI custom agents (`~/.kimi-code/agents/`, `.kimi-code/agents/`,
  plus generic `~/.agents/agents/` / `.agents/agents/`): directories are
  scanned **recursively** and support `override: true` semantics — deferred to
  a later round so nested layouts are handled correctly rather than silently
  flattened by the flat `readAgentsDir` helper.

## Decision

Reuse `readAgentsDir`/`planAgents` for `~/.qoder/agents/*.md` (user) and
`.qoder/agents/*.md` (project, via `--project`), byte-faithful, with an honest
warning that `tools`/`model`/`skills`/`mcpServers` frontmatter is
client-specific. `supportsAgents: true` on both adapters.
