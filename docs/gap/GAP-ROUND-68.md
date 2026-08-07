# GAP ROUND-68 — Baidu Comate (Zulu) research

Goal: pick the next high-value client. Selected: **Baidu Comate** (文心快码,
the Zulu agent in the Comate IDE plugins / Comate AI IDE) — 44th client.

## Official evidence

- MCP docs: https://comate.baidu.com/docs/IDE功能/MCP/
  - Project-scoped MCP config at `.comate/mcp.json`:
    ```json
    { "mcpServers": { "name": { "command": "...", "args": [], "env": {} } } }
    ```
  - Remote entries use `url` (+ `headers`); STDIO, SSE, and Streamable HTTP
    transports are supported; per-server enable/disable is toggled in the
    installed-servers UI (not stored in mcp.json). No documented user-level
    MCP file; docs warn to keep `.comate/mcp.json` under 5000 lines.
- Rules docs: https://comate.baidu.com/docs/IDE功能/智能体/规则/
  - Project rules at `.comate/rules/*.mdr` — markdown with a Cursor-style
    frontmatter (`description:` / `globs:` / `alwaysApply:`); activation
    modes: always applied, glob-based, or manual `#rulename`.
- Skills docs: https://cloud.baidu.com/doc/COMATE/s/Nmma28iqe
  - Agent Skills standard: `SKILL.md` with `name`/`description` frontmatter;
    directories `.agents/skills/`, `.comate/skills/` (project) and
    `~/.comate/skills/` (user). Comate explicitly loads skills from other
    Agent Skills-compatible tools.
- Memory: project-scoped, stored under `.comate`, created manually or formed
  automatically from conversations — but no stable documented file schema, so
  memory is **skipped with a warning** (not invented).

## Decision

Implemented `comate` (44th client):

- User scope: `~/.comate/skills/` only; MCP/rules warn to use `--project`.
- Project scope: `.comate/mcp.json` (merge-by-name, no `type`/`disabled`
  fields — sse and disabled warned), `.comate/rules/*.mdr` (export merges
  `.mdr`/`.md`, frontmatter kept as-is; import writes
  `.comate/rules/agentmove-imported.mdr` with `alwaysApply: true`), and
  `.comate/skills/`.
- Memory: app-managed under `.comate`; skipped with a warning.

## Deferred candidates

- **JetBrains ACP custom agents** (`~/.jetbrains/acp.json`,
  `agent_servers` + `default_mcp_settings`): adjacent to the existing
  `jetbrains` adapter but a different concept (agent launcher registry, not
  client config); revisit if user demand appears.
- **Cline CLI docs refresh**: current source uses
  `~/.cline/data/settings/cline_mcp_settings.json` (already what our adapter
  reads); older `~/.cline/mcp.json` references in their docs are stale.
- **mcp-doctor** (competitor): diagnostics/probes across clients — possible
  future UX inspiration (health checks), not an adapter.
