# GAP-ROUND-121: Auggie CLI custom agents (subagents)

## Target

Add the custom agents layer to the Auggie CLI adapter (user scope
`~/.augment/agents/`, project scope `.augment/agents/`).

## Official behavior (verified)

Sources:

- Official docs: https://docs.augmentcode.com/cli/subagents
- Shipped CLI source (`@augmentcode/auggie` 0.35.0, `augment.mjs`) —
  directory resolution, recursive scanner, and frontmatter parser were read
  directly from the published bundle.

Verified behavior:

- Locations: `~/.augment/agents/` (user) and `./.augment/agents/`
  (workspace). The CLI additionally reads the compatibility roots
  `~/.claude/agents/`, `./.claude/agents/`, `~/.agents/agents/`, and
  `./.agents/agents/` (roots list `[".augment", ".claude", ".agents"]`).
- The scanner is **recursive**; subdirectories become `:`-separated
  namespaces in the loaded agent name (`backend/sql.md` → `backend:sql`).
- Entries whose file or directory name starts with `.` are skipped.
- Accepted extensions: `.md` **and** `.txt`.
- Duplicate names: first found wins (scan order puts the user dir before the
  workspace dir for each root, and `.augment` before the compat roots).
- Every frontmatter field is optional: `name` (normalized, falls back to the
  file path), `description` (defaults to `Configuration from <file>`),
  `color`, `model`, `tools`, `disabled_tools` (if both `tools` and
  `disabled_tools` are set, `tools` is ignored), plus internal fields
  (`finish_tool`, provider overrides, `hidden`, ...). The markdown body is
  the agent prompt.

## Mapping decisions

- Export reads `~/.augment/agents/` recursively (`.md` + `.txt`), nested
  names preserved, hidden files/directories excluded, content byte-faithful.
  `.txt` agents are exported with a warning (other clients receive them as
  markdown); when both `name.md` and `name.txt` exist the `.md` file is
  exported (matching Auggie's first-found-wins loading, warned).
- Import writes `~/.augment/agents/<name>.md` (nested names preserved —
  Auggie's recursive loader discovers them as namespaced agents). Imports
  always write `.md`; Auggie loads both extensions.
- Frontmatter is copied as-is with a review warning
  (`name`/`description`/`color`/`model`/`tools`/`disabled_tools` are
  client-specific). Nothing is injected: every field is optional in Auggie.
- Project scope: `.augment/agents/` export/import with the same semantics.

## Explicitly out of scope (documented, warned where relevant)

- The compatibility roots `~/.claude/agents/` and `~/.agents/agents/`
  belong to the claude-code and kimi adapters respectively and are not read
  or written by the auggie adapter (same policy as the commands layer in
  ROUND-108/GAP-ROUND-55 lineage).
- Plugin-provided subagents (Auggie plugin marketplaces) are
  plugin-managed and not migrated.
- Intent custom specialists are configured through the Intent Settings UI
  (app-managed) and are not file-based; not migrated.
