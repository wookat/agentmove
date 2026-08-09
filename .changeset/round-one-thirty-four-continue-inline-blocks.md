---
"agentmove-cli": minor
---

Continue inline prompts and rules: `prompts:`/`rules:` entries defined inline in `~/.continue/config.yaml` and in `.continue/prompts/*.yaml` / `.continue/rules/*.yaml` local block files (user and project scope) are now exported. Inline prompts become synthesized markdown prompts with `invokable: true` frontmatter (matching continue's own prompt template; markdown prompt files win name duplicates with a warning); inline rules are merged into the exported instructions document, with a warning when scoping metadata (`globs`, `regex`, `alwaysApply`, `invokable`) is dropped. Hub `uses:` block references and malformed entries are skipped with warnings. Imports are unchanged and never write inline config entries.
