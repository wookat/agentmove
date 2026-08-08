# GAP-ROUND-117 — Kilo Code custom agents (custom modes)

## Selected improvement

Add the custom agents layer to the Kilo Code adapter (user + project scope).
Kilo renamed "custom modes" to **agents** and moved them from YAML/JSON
definitions to markdown files with YAML frontmatter.

## Evidence

- Official docs (https://kilo.ai/docs/customize/custom-modes):
  - Global markdown agents live in `~/.config/kilo/agent/my-agent.md`;
    project agents in `.kilo/agents/`, `.kilo/agent/`, or `.kilocode/agents/`.
  - "The filename (minus `.md`) becomes the agent name. Nested directories
    create namespaced names (e.g., `agents/backend/sql.md` becomes agent
    `backend/sql`)."
  - Legacy `custom_modes.yaml` is *not* loaded from `~/.config/kilo/`;
    Kilo reads legacy global modes from
    `~/.kilocode/cli/global/settings/custom_modes.yaml` and recommends
    converting to markdown under `~/.config/kilo/agent/`.
- Kilo CLI source (Kilo-Org/kilocode, packages/opencode):
  - `src/config/agent.ts` scans `{agent,agents}/**/*.md` (recursive, dot
    and symlink included) per config directory; nested relative paths become
    namespaced names via `configEntryNameFromPath`.
  - `src/kilocode/config/overlay.ts` `globalDirs()` returns
    `[~/.config/kilo, ~/.kilocode, ~/.kilo]`; project dirs are found up
    from the working directory for `.kilocode` and `.kilo`.
  - Frontmatter fields include `description`, `mode`
    (`primary`/`subagent`/`all`), `color`, `permission`, `hidden`, and
    model/temperature settings — all Kilo-specific.

## Behavior implemented

- User export: recursively read `agent/` + `agents/` under `~/.kilocode/`,
  `~/.kilo/`, and `~/.config/kilo/` (in that priority order — the XDG root
  wins on name conflicts, and within a root `agents/` wins over `agent/`,
  matching the glob's later-entry-overwrites semantics). A warning is
  emitted when legacy-root agents are exported.
- User import: writes only `~/.config/kilo/agents/`, preserving nested
  namespaced names as subdirectories.
- Project scope: exports `.kilocode/{agent,agents}` + `.kilo/{agent,agents}`
  (`.kilo` wins); imports write only `.kilo/agents/`.
- Content is byte-faithful; the Kilo-specific frontmatter fields
  (`description`/`mode`/`model`/`permission`/`color`/`hidden`) are copied
  as-is with the standard client-specific warning.

## Deferred (honest)

- Legacy `custom_modes.yaml` / `.kilocodemodes` YAML/JSON mode definitions
  are not converted — Kilo itself auto-converts them to agent markdown on
  startup, so a lossy re-implementation of that conversion adds risk without
  user value. Warned in docs, not migrated.
- Organization-managed agents are delivered via Kilo's cloud and have no
  local files to migrate.
- GitHub Copilot CLI `.claude/commands/` compatibility support (shipped in
  copilot-cli v0.0.399) remains deferred: the `.claude/commands/` root
  belongs to the Claude Code adapter and duplicating it under the copilot
  adapter would double-read/write the same files. Still no documented
  copilot-owned commands root.
