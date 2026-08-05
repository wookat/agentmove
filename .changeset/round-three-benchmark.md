---
"agentmove-cli": patch
---

Production-benchmark round 3: new `agentmove clients [--json]` command listing
supported clients and their default config locations, `export --json` for
consistency with the other commands, and permission errors (EACCES/EPERM) now
include remediation guidance.
