---
"agentmove-cli": minor
---

Grok CLI: custom sub-agents interop + real skills root. Export converts `subAgents` entries from `~/.grok/user-settings.json` into portable agents (`instruction` only; the per-agent `model` is dropped with a warning; reserved built-in names, duplicates, and instruction-less entries are warned and not migrated). Import merges portable agents back into `subAgents` with grok's default model, preserving all other user-settings keys and existing entries (same-name overwrites, nested-name flattening, and reserved-name skips are warned). Agent Skills now read/write grok's real root `~/.agents/skills` (project `.agents/skills`); the legacy `~/.grok/skills` root — which grok never loads — is still read on export with warnings.
