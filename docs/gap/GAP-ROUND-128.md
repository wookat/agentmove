# GAP-ROUND-128: Grok CLI custom sub-agents + real skills root

## Gap

Before this round the `grok` adapter covered `~/.grok/config.toml`
(`[mcp_servers.*]`), `~/.grok/AGENTS.md`, and Agent Skills — but read/wrote
skills under `~/.grok/skills/`, and it had no custom-agents layer even though
Grok CLI supports user-defined foreground sub-agents.

Two problems, both established from upstream source
(https://github.com/superagent-ai/grok-cli):

1. **Wrong skills root.** Grok discovers Agent Skills from
   `~/.agents/skills` (user) and `.agents/skills` walking from the project
   root up to the git root (`src/utils/skills.ts`: `discoverSkills()` uses
   `path.join(os.homedir(), ".agents", "skills")`; project roots come from
   `listProjectSkillRoots`). Skills were introduced with these roots in
   PR #169 — `~/.grok/skills/` was **never** a grok path
   (`git log -S '".grok", "skills"'` finds nothing), so skills previously
   written there by agentmove were never loaded by grok.
2. **Missing custom sub-agents layer.** Grok custom sub-agents are
   `subAgents` entries in `~/.grok/user-settings.json`
   (`src/utils/settings.ts`): `{name, model, instruction}` records.
   `parseSubAgentsRawList()` skips entries whose name is empty or reserved
   (`general`, `explore`, `vision`, `verify`, `verify-detect`,
   `verify-manifest`, `computer` — `RESERVED_SUBAGENT_NAMES`), whose model
   is not a valid model id, and case-insensitive duplicates (first entry
   wins). Sub-agents are user-level only: `ProjectSettings`
   (`.grok/settings.json`) has no `subAgents` key. The README documents
   the feature ("Custom sub-agents — define named agents with `subAgents`
   in `~/.grok/user-settings.json`, managed with `/agents`").

## Design

### Skills

- Export reads `~/.agents/skills` plus the legacy `~/.grok/skills` root
  (compatibility with skills written there by older agentmove versions):
  `~/.agents/skills` wins duplicate names with a shadow warning, and every
  legacy-only skill carries a warning that grok does not load that root.
- Imports write only `~/.agents/skills` (project: `.agents/skills`).

### Custom sub-agents (documented conversion, not byte-faithful)

- Export (`readGrokAgents`): each valid `subAgents` entry becomes a portable
  agent — `instruction` is the body, the name is the entry `name` (trimmed).
  The per-agent `model` has no portable equivalent and is dropped with a
  per-agent warning. Entries grok itself ignores — reserved names,
  case-insensitive duplicates, and entries without a name or a non-blank
  instruction — are warned and not migrated. Model-id validity is not
  re-checked on export (agentmove does not track grok's model list); the
  model is dropped either way.
- Import (`planGrokAgents`): merges into the `subAgents` list of
  `~/.grok/user-settings.json`, preserving every other settings key and all
  pre-existing entries verbatim. Same-lowercase-name entries are overwritten
  (warned). Grok drops entries without a valid model id, so imports assign
  the grok default model `grok-4.3` (warned via the import summary).
  Nested portable names flatten (`team/planner` → `team-planner`, warned);
  post-flatten collisions are skipped (warned); reserved names are skipped
  (warned, grok would ignore them); frontmatter is kept verbatim inside the
  instruction (warned — subAgents entries have no metadata fields).
- No project scope: sub-agents only exist in user settings; the generic
  "no custom agents directory at project scope" warning applies.

## Deferred / out of scope

- Grok's `.grok/environment.json` verify manifest, delegations store,
  hooks, and telegram/audio settings are client-runtime state, not
  portable configuration.
- Project skill discovery walks parent directories up to the git root;
  agentmove reads only the project root's `.agents/skills`.

## Tests

`test/grok.test.ts`: fixture export (valid/reserved/duplicate/blank/nameless
subAgents entries with exact warnings), legacy-skills shadow/warning
behavior, import merge preserving unrelated settings keys and existing
entries (overwrite, flatten, reserved skip, frontmatter verbatim, default
model), agents-only vs mcp-only file isolation, and the project-scope
`.agents/skills` round-trip.
