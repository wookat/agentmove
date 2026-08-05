---
"agentmove-cli": patch
---

Production-benchmark round 1: imports now merge MCP servers into the target's
existing list instead of replacing it (opt out with `--replace-mcp`), config
parse errors include the offending file path, and the CLI follows a documented
exit-code contract (0 success, 1 unexpected, 2 usage, 3 bad input data).
