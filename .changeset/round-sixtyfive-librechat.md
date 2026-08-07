---
"agentmove-cli": minor
---

New client: LibreChat (`librechat`, 39th client). Project-scoped migration of the deployment's `librechat.yaml` `mcpServers` map (use `--project` in the LibreChat deployment directory): stdio servers use `command`/`args`/`env`, remote servers use `url`/`headers` with explicit `type: sse`/`streamable-http` (an omitted `type` on an http(s) url means SSE); websocket servers are skipped with a warning; `timeout`/`customUserVars`/`oauth` and other client-specific keys are warned and preserved on merge; all other YAML keys are preserved on rewrite. Custom prompts, agents, and memory are app-managed (database) and skipped with honest warnings.
