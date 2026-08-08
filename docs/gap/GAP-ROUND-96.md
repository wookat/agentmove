# GAP ROUND-96: Cursor custom subagents

## Finding

Cursor has first-class custom subagents defined as markdown files with YAML
frontmatter, at both user and project scope. AgentMove's agents layer (added
in rounds 94–95) skipped Cursor with a "no custom agents directory" warning,
which is now stale.

## Official evidence

- Cursor docs — Subagents: https://cursor.com/docs/context/subagents
  (canonical slug: https://cursor.com/docs/subagents)
  - "File locations": project `.cursor/agents/`, user `~/.cursor/agents/`.
  - Project subagents take precedence when names conflict.
  - File format: markdown with YAML frontmatter; documented fields include
    `name`, `description`, `model` (+ model parameters), `read_only`,
    `is_background`.
  - Built-in subagents (`explore`, `bash`, `browser`) need no files and are
    not part of the on-disk layer.
  - Background subagent *output* goes to `~/.cursor/subagents/` — runtime
    state, not configuration; not migrated.

## Decision

- Export/import `~/.cursor/agents/*.md` (user) and `.cursor/agents/*.md`
  (project) byte-faithfully via the existing `readAgentsDir`/`planAgents`
  helpers.
- Honest warning on import: `model`/`read_only`/`is_background` frontmatter
  is client-specific and copied as-is.
- No frontmatter normalization into an invented common schema (same boundary
  as rounds 94–95).

## Rejected alternatives

- Migrating `~/.cursor/subagents/` output logs — runtime artifacts, not
  configuration.
- Mapping Cursor's `read_only`/`is_background` onto other clients' fields
  (e.g. Qwen `approvalMode`) — no documented equivalence; would be lossy and
  dishonest.
