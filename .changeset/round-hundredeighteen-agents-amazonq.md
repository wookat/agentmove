---
"agentmove-cli": minor
---

Custom agents layer for Amazon Q Developer CLI: `~/.aws/amazonq/cli-agents/*.json` (project scope `.amazonq/cli-agents/`) converts to/from portable markdown agents — `description` maps to frontmatter and `prompt` to the body; amazonq-specific fields (tools/allowedTools/mcpServers/hooks/...) are dropped with per-field warnings. Imports write `{description, prompt}` agent JSON, flattening nested names with a warning.
