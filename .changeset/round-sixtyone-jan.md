---
"agentmove-cli": minor
---

Jan adapter (37th client): `~/.local/share/Jan/data/mcp_config.json` `mcpServers` map — every entry carries `command`/`args` (empty for remote servers), remote entries use `type` (`http`/`sse`) plus `url`/`headers`, the native `active` flag round-trips as enabled, `timeout`/`official` warned as client-specific and preserved on merge, and `mcpSettings`/other top-level keys are preserved on rewrite. Assistants, models, and chats are app-managed and skipped with warnings.
