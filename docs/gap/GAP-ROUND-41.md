# GAP-ROUND-41 — Roo Code adapter (19th client)

## Evidence

- Roo Code is one of the most-installed AI coding VS Code extensions (RooCodeInc/Roo-Code,
  a fork lineage of Cline with its own large user base) and a frequent "migrate my MCP
  setup" source/target in community discussions.
- Official docs researched:
  - MCP: https://docs.roocode.com/features/mcp/using-mcp-in-roo — global config in
    `mcp_settings.json` (VS Code globalStorage `rooveterinaryinc.roo-cline/settings/`),
    project config in `.roo/mcp.json`, root key `mcpServers`; stdio uses
    `command`/`args`/`env`/`cwd`; remote entries **require** an explicit
    `type: "streamable-http"` or `"sse"` (a bare `url` is an immediate error in Roo);
    native `disabled` flag; client-specific `alwaysAllow`, `disabledTools`, `timeout`,
    `watchPaths`.
  - Rules: https://docs.roocode.com/update-notes/v3.22.0 — global rules in
    `~/.roo/rules/`, project rules in `.roo/rules/`.
  - Skills: https://docs.roocode.com/features/skills — Agent Skills standard
    (`SKILL.md`) in `~/.roo/skills/` and `.roo/skills/` (also reads `~/.agents/skills`).
- Real data: npm downloads for agentmove-cli 08-04=131, 08-05=1607; hermes-agent still
  0.19.0 (no competitor movement).

## Gap

P1: Roo Code users could not migrate in or out. High fidelity possible: native
disabled flag, rules directory, and standard Agent Skills all map cleanly.

## Implementation

- `src/adapters/roo.ts`: user-level adapter — three-platform globalStorage lookup,
  `streamable-http`↔portable `http` mapping (render always emits Roo's explicit
  `type`), native `disabled` round-trip, `~/.roo/rules/*.md` merged as instructions
  (source markers, warning when merged), `~/.roo/skills` Agent Skills, memory
  skipped with warning, persona approximated into `~/.roo/rules/agentmove.md`.
- `src/project.ts`: `rooProject` — `.roo/mcp.json` + `.roo/rules/` + `.roo/skills/`.
- Matrix expanded to 19×19; round-trip targets include roo; 114 tests green.

## Verification

- build/lint/typecheck green; coverage branches 65.81% (gate 65%).
- e2e full matrix and round-trip pass; fixtures use placeholder tokens only.
