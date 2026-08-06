# GAP-ROUND-43 — Crush adapter (21st client)

## Evidence

- Official docs (charmbracelet/crush):
  - MCP configuration — `mcp` map in `crush.json`; `type` is required
    (`stdio`/`http`/`sse`); stdio uses `command`/`args`/`env`, remote uses
    `url`/`headers`; per-server `disabled`, `disabled_tools`, `timeout`.
    https://www.mintlify.com/charmbracelet/crush/configuration/mcp
  - Config priority — `.crush.json` (project, hidden) > `crush.json` (project)
    > `$XDG_CONFIG_HOME/crush/crush.json` (global). Context files are
    project-scoped (`CRUSH.md`, `AGENTS.md`, `CLAUDE.md`, ... in
    `defaultContextPaths`); default project skill paths include
    `.crush/skills` and `.agents/skills`.
    https://github.com/charmbracelet/crush/blob/main/internal/skills/builtin/crush-config/SKILL.md
  - Skills — Agent Skills standard (`SKILL.md` folders) discovered from
    `~/.config/crush/skills/` (Linux/macOS default).
    https://charmbracelet-crush.mintlify.app/configuration/skills
- Real data: agentmove-cli npm downloads still 131 (08-04) / 1607 (08-05).
  Crush is Charm's popular open-source terminal coding agent still missing
  from the matrix.

## Gap (P1)

Crush users could not migrate MCP servers or skills in or out of AgentMove's
20-client matrix. Crush's explicit-type `mcp` map, native `disabled` flag, and
project-file config priority need dedicated handling.

## Implementation

- `src/adapters/crush.ts`: user scope — parse/render the `mcp` map in
  `~/.config/crush/crush.json` (explicit `type` on every entry; native
  `disabled` ↔ portable `enabled: false`), merge preserving other config keys
  and client-specific per-server keys, `--replace-mcp` support, Agent Skills
  in `~/.config/crush/skills/`. Honest warnings: `disabled_tools`/`timeout`
  client-specific; context files project-only (instructions/persona skipped at
  user scope with pointer to `--project`); no durable memory.
- `src/project.ts`: project scope — export `.crush.json`/`crush.json` `mcp`,
  `CRUSH.md` (fallback `AGENTS.md`), `.crush/skills/`; import merges into the
  existing project config file (preferring `.crush.json` when present) and
  writes `CRUSH.md` + `.crush/skills/`.
- Matrix expanded to 21×21; round-trip targets include crush.

## Verification

- build / lint / typecheck green; website build green.
- 22 test files, 122 tests green; branch coverage 66.1% (≥65% gate).
- New unit tests: map export with disabled + client-specific warnings, merge
  preserving existing entries and client keys, `--replace-mcp`, missing home,
  project scope (config priority, CRUSH.md, .crush/skills).
