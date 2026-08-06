# GAP-ROUND-47 — Droid (Factory) adapter, 23rd client

Round type: ecosystem-driven client expansion.

## Why Droid

Factory's Droid CLI is one of the fastest-growing terminal coding agents
(Factory raised at a multi-billion valuation in 2025; droid tops several
terminal-agent benchmarks) and has a fully documented, file-based config
surface — a perfect AgentMove fit.

## Official documentation evidence

- MCP: https://docs.factory.ai/cli/configuration/mcp
  - User config `~/.factory/mcp.json`, project `.factory/mcp.json`,
    `mcpServers` map.
  - `type`: `stdio` | `http` | `sse` (may be omitted for stdio).
  - stdio: `command`, `args`, `env`. Remote: `url`, `headers`, `oauth`.
  - Common fields: `disabled` (boolean), `disabledTools` (string[]),
    `timeout`, `connectTimeout` (ms).
  - `${NAME}` references are expanded from the shell env — matches our
    redaction placeholder format exactly.
  - OAuth tokens live in the system keyring, never in the file.
- Skills: https://docs.factory.ai/harness/skills
  - Personal `~/.factory/skills/<name>/SKILL.md`; project
    `.factory/skills/`; compatibility scopes `~/.agents/skills/**` etc.
    We use the primary `~/.factory/skills/` path.
- Instructions: https://docs.factory.ai/harness/agents-md
  - Personal `~/.factory/AGENTS.md`; project `AGENTS.md` (plus `.factory/`,
    `.agents/`, `.agent/` compatibility directories).

## Implementation

- `adapters/droid.ts`: `mcpServers` map parse/render (explicit `type`,
  native `disabled` round-trip), client-specific keys warned + preserved on
  merge (`disabledTools`, `timeout`, `connectTimeout`, `oauth`),
  `~/.factory/AGENTS.md` instructions round-trip (persona appended there,
  approximated), skills at `~/.factory/skills/`, no durable memory (warned).
- `project.ts` `droidProject`: `.factory/mcp.json` + root `AGENTS.md`
  (`.factory/AGENTS.md` fallback on export) + `.factory/skills/`.
- Matrix: 23×23; fixture `droid-home` (stdio with disabledTools, http with
  disabled, http with headers + oauth:false; AGENTS.md; 1 skill).
- Docs: README/introduction/clients/limitations/man/hero — the ROUND-46
  docs-sync guard enforced every one of these updates (count word
  "twenty-three" included).

## Known limitations (documented + warned)

- OAuth tokens are keyring-managed — never exported.
- Custom droids (`~/.factory/droids/*.md`), commands, and settings.json are
  Droid-specific features with no portable equivalent; not migrated.
- Folder-level (ancestor) `.factory/mcp.json` scope is not modeled; user +
  project scopes cover the documented primary workflows.

## Verification

- 25 test files / 133 tests green; lint + typecheck + website build green.
- Branch coverage 66.68% (gate: 65%).
