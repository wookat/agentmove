---
"agentmove-cli": minor
---

Custom agents layer for Auggie CLI: export/import subagents in
`~/.augment/agents/` (project scope `.augment/agents/`), scanned
recursively with nested names preserved and content byte-faithful. The
loader-verified `.txt` agent files are exported with a warning (imports
always write `.md`; Auggie loads both), `.md` wins a same-name `.md`/`.txt`
collision (warned), and hidden files/directories are excluded. All
frontmatter fields are optional in Auggie; `name`/`description`/`color`/
`model`/`tools`/`disabled_tools` are client-specific and copied as-is with
a review warning. The compatibility roots `~/.claude/agents/` and
`~/.agents/agents/` belong to other adapters and are not read or written.
