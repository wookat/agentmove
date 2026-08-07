---
"agentmove-cli": minor
---

Codex CLI (and Xcode Codex): full remote-MCP auth field support. `bearer_token_env_var` now exports as an `Authorization: Bearer ${VAR}` placeholder header and `env_http_headers` entries export as `${VAR}` placeholder headers — both are portable across all 46 clients and written back natively when importing into Codex. Per-server client-specific fields (`startup_timeout_sec`, `tool_timeout_sec`, `env_vars`, `enabled_tools`, `disabled_tools`, `default_tools_approval_mode`, `tools`, `auth`, `experimental_environment`) now raise an honest export warning instead of being dropped silently (they were and are preserved on merge). Secret redaction skips values that are already env-var placeholders (`${VAR}` / `Bearer ${VAR}`) and keys that name env vars (`*_env_var(s)`).
