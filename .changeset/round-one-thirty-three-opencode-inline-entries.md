---
"agentmove-cli": minor
---

OpenCode inline config entries: agents, commands and primary modes defined
inline under the `agent`, `command` and `mode` keys of
`opencode.json`/`opencode.jsonc` (in `~/.config/opencode/` and the
`~/.opencode/` fallback; project scope reads the root and `.opencode/`
config files) are now exported as synthesized markdown, matching opencode's
merge order: the inline `mode` map merges last and wins duplicates with
`mode: "primary"`, while markdown files beat inline `agent`/`command` entries
from the same config dir. Each exported inline entry gets a warning naming
its source file; `disable: true` entries and inline commands without a
`template` are skipped with warnings, and `{file:...}`/`{env:...}`
placeholders are copied as-is with a warning. Imports are unchanged and never
write inline config entries.
