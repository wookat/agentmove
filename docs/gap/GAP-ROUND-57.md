# GAP-ROUND-57: Kimi Code CLI (33rd client)

## Why Kimi Code CLI

- Moonshot AI's terminal coding agent (`kimi`), 6k+ GitHub stars shortly after
  release, MIT-licensed, cross-platform, first-party docs.
- Uses AGENTS.md and the Agent Skills standard — high-fidelity mapping to the
  portable bundle.
- Ships a built-in `import-from-cc-codex` skill (importing from Claude Code /
  Codex only) — evidence of real demand for migration into Kimi that AgentMove
  covers in every direction.

## Official sources

- https://moonshotai.github.io/kimi-code/en/customization/mcp
- https://moonshotai.github.io/kimi-code/en/configuration/config-files
- https://moonshotai.github.io/kimi-code/en/configuration/data-locations.html
- https://moonshotai.github.io/kimi-code/en/customization/skills
- https://moonshotai.github.io/kimi-code/en/reference/kimi-command

## Verified format

- User MCP: `~/.kimi-code/mcp.json` (`$KIMI_CODE_HOME/mcp.json`), root key
  `mcpServers`.
  - stdio: `command` (string) + `args` + `env` + `cwd` (cwd IS supported).
  - HTTP: plain `url` (+ optional `headers`), no transport field.
  - Legacy SSE: `transport: "sse"` + `url`.
  - Native `enabled: false` — round-trips.
  - Client-specific per-server fields: `bearerTokenEnvVar`,
    `startupTimeoutMs`, `toolTimeoutMs`, `enabledTools`, `disabledTools` —
    warned, preserved on merge.
- Global instructions: `~/.kimi-code/AGENTS.md`.
- User skills: `~/.kimi-code/skills/` (Agent Skills standard; generic
  `~/.agents/skills/` is also scanned by Kimi but is a cross-tool location
  owned by other adapters).
- Project scope: `.kimi-code/mcp.json` (overrides same-name user entries),
  root `AGENTS.md`, `.kimi-code/skills/`.
- Model/provider config lives in `~/.kimi-code/config.toml` — app/client
  managed, not migrated.

## Lossiness

- persona → appended to AGENTS.md (approximated, warned).
- memory → no durable store; skipped with warning (use `--mif`).
- client-specific per-server fields → not migrated (warned), preserved on
  merge for existing entries.

## Deferred

- `$KIMI_CODE_HOME` relocation env var is not followed (documented in
  clients.md); AgentMove reads the default `~/.kimi-code/`.
- `~/.agents/skills/` and `.agents/skills/` generic tiers are shared
  cross-tool locations (already handled by codex/amp/goose adapters where
  relevant) — not duplicated here.
- Custom agents (`~/.kimi-code/agents/`) and plugins are Kimi-specific
  prompt configuration — out of scope for the portable bundle for now.
