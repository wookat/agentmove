# GAP-ROUND-119: custom agents layer for Roo Code (custom modes)

## Evidence

- Custom modes (official docs):
  https://docs.roocode.com/features/custom-modes
  - Global modes: `custom_modes.yaml` in the extension's settings folder
    (globalStorage `settings/`, next to `mcp_settings.json`).
  - Project modes: a `.roomodes` file at the workspace root; project
    modes take precedence over global modes by slug.
  - Fields: `slug`, `name`, `description`, `roleDefinition`, `whenToUse`,
    `customInstructions`, `groups` (tool groups, optionally with
    `fileRegex` restrictions).
  - Mode-specific rules live in `.roo/rules-{slug}/` folders.
- Source of truth (Roo-Code repo):
  - `src/shared/globalFileNames.ts`: `customModes: "custom_modes.yaml"`.
  - `src/core/config/CustomModesManager.ts`: `.roomodes` is parsed as
    YAML with a JSON fallback; global file is YAML only; modes merge by
    slug with project winning; import overwrites same-slug modes.
  - `packages/types/src/mode.ts` (`modeConfigSchema`): slug must match
    `^[a-zA-Z0-9-]+$`; `name`, `roleDefinition`, and `groups` are
    required; `description`/`whenToUse`/`customInstructions` optional.

## Decision

Add the custom agents layer to `roo` (user + project scope) via a
**documented lossy conversion** (same policy as the Amazon Q agent JSON
conversion):

- Export: mode `slug` → agent name, `description` → single frontmatter
  line, `roleDefinition` → markdown body. Display `name` values that
  differ from the slug, `whenToUse`, `customInstructions`, `groups`, and
  any other field are roo-specific and dropped with per-field warnings.
  Slug-less modes and modes with neither `roleDefinition` nor
  `description` are skipped with warnings, never silently.
- Import: agents become mode entries merged into the existing
  `custom_modes.yaml` / `.roomodes` by slug (same-slug overwrites are
  warned; existing modes, slug-less entries, and non-`customModes` keys
  are preserved). Imported modes get `name` = slug, the full default tool
  `groups` (`read`/`edit`/`browser`/`command`/`mcp`, warned to review),
  and `roleDefinition` from the body. Nested names are flattened
  (`backend/sql` → `backend-sql`, warned) and invalid slug characters
  sanitized (warned). Frontmatter with fields beyond `description` is
  kept verbatim inside `roleDefinition` (warned).
- roo → roo round-trips are parse-equivalent for the portable fields
  (slug + description + roleDefinition).

## Deferred (with reasons)

- Mode-specific `.roo/rules-{slug}/` rule folders: they are per-mode
  instruction directories with no portable per-agent-rules equivalent in
  the bundle model; migrating them into the agent body would change how
  Roo layers instructions. Not migrated (documented).
- Mapping `groups`/`fileRegex` tool restrictions to other clients'
  `tools:` frontmatter: semantics differ per client (allowlists vs
  groups vs regex-scoped edit permissions); an honest mapping does not
  exist, so they are dropped with warnings instead.
- Roo's own mode export format (`rulesFiles` embedded in the YAML) is an
  import/export convenience of the extension UI, not a discovery
  location; not scanned.
