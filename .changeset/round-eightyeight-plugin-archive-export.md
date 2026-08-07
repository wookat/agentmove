---
"agentmove-cli": minor
---

Plugin archive export: `export <client> --plugin -o <file>.zip` (or `.tgz` /
`.tar.gz`) packages the Agent Plugin as a ready-to-publish archive — e.g. a
GitHub release asset — instead of a directory. The plugin name is the filename
without the archive suffix; contents are identical to the directory form and
round-trip through the existing archive import.
