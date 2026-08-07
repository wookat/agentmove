---
"agentmove-cli": minor
---

New client: Baidu Comate (`comate`, 44th client). User scope migrates global
Agent Skills from `~/.comate/skills/`; MCP servers and rules are
project-scoped — `--project` covers `.comate/mcp.json` (`mcpServers`,
merge-by-name; no `type`/`disabled` fields, sse and disabled states warned),
`.comate/rules/*.mdr` project rules (export merges them into instructions
with frontmatter kept as-is; import writes
`.comate/rules/agentmove-imported.mdr` with an `alwaysApply: true`
frontmatter), and `.comate/skills/`. Chat memory is app-managed under
`.comate` and skipped with a warning.
