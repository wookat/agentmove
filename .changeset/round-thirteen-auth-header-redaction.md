---
"agentmove-cli": patch
---

Security: `Authorization` and `Cookie`-style MCP headers are now redacted to
`${VAR}` placeholders on export by default (previously only names matching
key/token/secret/password/credential were). Use `--include-secrets` to keep
real values.
