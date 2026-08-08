---
"agentmove-cli": patch
---

`export --skills-repo` now strips `gh skill install` source-tracking metadata
(the `metadata.github-*` frontmatter keys the GitHub CLI injects on install)
from each `SKILL.md`, with a warning per affected skill — mirroring
`gh skill publish --fix`, so the exported repository passes
`gh skill publish` validation directly. All other frontmatter keys and file
contents remain byte-identical.
