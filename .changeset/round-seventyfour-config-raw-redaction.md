---
"agentmove-cli": patch
---

Security: the raw source-config snapshot kept in the bundle's `config.json` is now redacted recursively by default — likely-secret values (`*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `*AUTHORIZATION*`, `*COOKIE*`) anywhere in the snapshot are replaced with `${VAR}` placeholders, matching the existing MCP-layer redaction. Pass `--include-secrets` to keep literal values.
