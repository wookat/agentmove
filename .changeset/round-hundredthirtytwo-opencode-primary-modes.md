---
"agentmove-cli": minor
---

OpenCode primary modes now migrate: `{mode,modes}/*.md` in both `~/.config/opencode/` and the `~/.opencode/` fallback config dir (project: `.opencode/{mode,modes}/`) are exported into the custom agents layer byte-faithfully. Matching opencode's merge order, the scan is flat (nested mode files are ignored) and a mode beats a same-name agent within its config dir; each mode entry carries a warning noting opencode loads it with `mode: "primary"`. Imports still write only the native agents roots and never synthesize mode files.
