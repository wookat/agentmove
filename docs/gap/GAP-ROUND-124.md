# GAP-ROUND-124: Nanocoder skill bundles

## Implemented

Nanocoder skill bundles (`~/.config/nanocoder/skills/<bundle>/`, project
`.nanocoder/skills/<bundle>/`) now export their portable members:

- `commands/*.md` export as `<bundle>/<name>` commands (bare `<bundle>` when
  the file basename equals the bundle name), mirroring nanocoder's
  `/<bundle>:<name>` invocation and auto-namespace shortcut.
- The single `agents/*.md` subagent exports by file basename; extra `.md`
  files are ignored with a warning, matching nanocoder's loader
  ("only one subagent per bundle is supported").
- Bundle contents are byte-faithful; names already taken by the flat
  `commands/` / `agents/` directories win on collision (warned).
- `skill.yaml` is validated the way nanocoder validates it: kebab-case
  `name` (`/^[a-z][a-z0-9-]*$/`) and a non-empty `description` are required;
  invalid manifests skip the bundle with a warning.
- `skill.yaml` extras (`version`/`author`/`tags`/`subscribe`/
  `tools_visibility`) are nanocoder-specific and warned, not migrated.
- Bundle `tools/` are nanocoder shell tools (YAML-frontmatter markdown that
  spawns a shell) and are warned, not migrated.
- Imports are unchanged: portable commands/agents keep writing the flat
  `commands/` / `agents/` directories. A command imported at
  `commands/<bundle>/<name>.md` is invoked by nanocoder as
  `/<bundle>:<name>`, so bundle-command invocations round-trip without
  synthesizing bundles.

## Evidence

- nanocoder 1.29.0 source (`source/skills/bundle-loader.ts`): bundle layers
  are project `.nanocoder/skills/`, personal `<getConfigPath()>/skills/`
  (Linux `~/.config/nanocoder/skills/`, macOS
  `~/Library/Preferences/nanocoder/skills/`, Windows `%APPDATA%/nanocoder/skills/`),
  and built-in; a bundle is any subdirectory containing `skill.yaml`;
  duplicate bundle names within a layer keep the first; only one subagent
  per bundle.
- `source/skills/manifest-parser.ts`: manifest validation rules mirrored
  here (name regex, required description, optional
  version/author/tags/include/subscribe/tools_visibility).
- Bundle command namespacing (`commands/status.md` in bundle `k8s` invokes
  as `/k8s:status`; `commands/k8s.md` invokes as bare `/k8s`) is in
  `loadCommandMembers` and the 1.24.0 changelog entry introducing Skills.
- Flat commands subdirectories are `:`-separated namespaces (existing
  adapter behavior), which is why flat-import of `<bundle>/<name>` restores
  the `/<bundle>:<name>` invocation.

## Deferred (honest)

- **Bundle synthesis on import**: writing `skill.yaml` bundles (rather than
  flat files) would require inventing manifests (description, visibility)
  agentmove cannot know; flat import already round-trips invocations.
- **Bundle `tools/` migration**: nanocoder custom shell tools execute
  arbitrary shell commands and have no portable equivalent in any other
  client agentmove supports; migrating them silently would be a security
  and correctness hazard. Warned instead.
- **`subscribe:` event triggers** (file-watch/cron via the nanocoder
  daemon): client-specific runtime behavior, warned via the manifest-extras
  warning.
- **Built-in bundles** (shipped inside the nanocoder package): not user
  data; not read.
- **macOS/Windows personal roots**: agentmove's nanocoder adapter keeps the
  documented Linux-style `~/.config/nanocoder/` root (same as MCP/commands/
  agents; `NANOCODER_CONFIG_DIR` relocations are not followed) — unchanged
  from previous rounds.
