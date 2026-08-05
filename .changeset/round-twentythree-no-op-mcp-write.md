---
"agentmove-cli": patch
---

A memory/instructions-only import (e.g. `--only memory` or `--mif`) no longer
rewrites the target client's MCP/config file when the import brings no MCP
servers, no `--replace-mcp`, and no model change — the file is now left
completely untouched instead of being re-serialized.
