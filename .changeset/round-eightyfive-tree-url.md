---
"agentmove-cli": minor
---

Tree URL import: `import <client> -i https://…/tree/<branch>[/<dir>]` clones the
repository at that branch and imports just that directory — e.g. a single skill
out of a many-skill repository (`…/agent-skills/tree/main/skills/web-design`).
A missing directory is a data error (exit 3).
