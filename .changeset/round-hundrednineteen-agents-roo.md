---
"agentmove-cli": minor
---

Custom agents layer for Roo Code: custom modes in the globalStorage `settings/custom_modes.yaml` (project scope: `.roomodes`, YAML with a JSON fallback) now migrate as portable agents via a documented conversion — the mode `slug` becomes the agent name, `description` maps to a frontmatter line, and `roleDefinition` to the markdown body. Roo-specific fields (display `name` differing from the slug, `whenToUse`, `customInstructions`, `groups`, and anything else) are dropped with per-field warnings; slug-less or roleDefinition-less modes are skipped with warnings. Imports merge into the modes file by slug (same-slug overwrites warned, existing modes and non-mode keys preserved), assign the full default tool `groups` (warned to review), flatten nested agent names (`backend/sql` → `backend-sql`, warned), and keep multi-field frontmatter verbatim inside `roleDefinition` (warned). Mode-specific `.roo/rules-{slug}/` folders are not migrated.
