# GAP-ROUND-98: custom agents layer for Droid (Factory)

## Research (official sources)

- Factory docs — Custom droids (subagents): https://docs.factory.ai/harness/subagents
- Factory CLI configuration — custom droids: https://docs.factory.ai/cli/configuration/custom-droids

Documented behavior:

- Custom droids are reusable subagents defined as **markdown files with YAML
  frontmatter** (system prompt in the body).
- Personal droids: `~/.factory/droids/*.md`; project droids: `.factory/droids/*.md`
  (shared through the repository). Project definitions override personal ones
  on name conflicts.
- The CLI scans the **top level** of each `droids/` folder only — a flat
  directory, matching our existing `readAgentsDir`/`planAgents` helpers.
- Frontmatter fields: `name` (required, `^[a-z0-9-_]+$`), `description`,
  `model` (or `inherit`), `reasoningEffort`, `tools` (category string or
  array of tool IDs), `mcpServers` (must match entries in mcp.json).
- Built-in droids `worker` and `explorer` need no definition and are not
  on-disk files — nothing to migrate.
- Factory Missions writes a few built-in droids (e.g. `scrutiny-feature-reviewer`)
  to `~/.factory/droids/` — these are ordinary valid `.md` droid definitions
  and are indistinguishable from user files, so they migrate like any other
  agent (byte-faithful; harmless in other clients).

## Decision

- Extend the portable `agents` layer to Droid: user scope `~/.factory/droids/`,
  project scope `.factory/droids/`, extension `.md`, byte-faithful.
- Reuse `readAgentsDir` / `planAgents`; set `supportsAgents: true` on the user
  and project adapters.
- Import warning: `tools`/`model`/`reasoningEffort`/`mcpServers` frontmatter is
  client-specific and copied as-is.

## Rejected / deferred

- No frontmatter conversion (e.g. mapping Droid `tools: read-only` to Claude
  Code tool lists): lossy and speculative; honest as-is copy + warning instead.
- No filename normalization: Droid normalizes names when *it* creates files;
  we preserve the user's bytes and names.
