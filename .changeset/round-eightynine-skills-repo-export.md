---
"agentmove-cli": minor
---

Skills repository export: `export <client> --skills-repo <dir>` also writes the
skills layer as a skills repository in the conventional
`skills/<name>/SKILL.md` layout — ready to commit and publish with
`gh skill publish`, install with `npx skills add`, or import back with
`agentmove import -i`. A path ending in `.zip`/`.tgz`/`.tar.gz` writes it as an
archive; exporting a client with no skills is a data error (exit 3).
