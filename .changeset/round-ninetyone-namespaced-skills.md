---
"agentmove-cli": minor
---

Skills repository import now understands the namespaced
`skills/<scope>/<name>/SKILL.md` layout used by `gh skill install` and large
community repositories like `github/awesome-copilot` — namespaced and direct
`skills/<name>/` entries can be mixed in one repository. On a skill-name clash
across namespaces the later skill is imported as `<scope>-<name>` with an
honest warning; hidden directories are skipped.
