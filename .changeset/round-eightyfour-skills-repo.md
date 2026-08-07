---
"agentmove-cli": minor
---

Skills repository import: `import <client> -i <dir-or-url>` now auto-detects a
skills repository (the skills.sh / `npx skills add owner/repo` ecosystem) —
`SKILL.md` directories under `skills/`, at the repository top level, or a single
root `SKILL.md` (named from its frontmatter) — and installs the skills into any
client's skills location with the usual dry-run/merge/backup semantics.
