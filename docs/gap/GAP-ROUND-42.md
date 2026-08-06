# GAP-ROUND-42 — Continue adapter (20th client)

## Evidence

- Official docs (docs.continue.dev):
  - config.yaml reference — `mcpServers` is a **list** (not a map); entries carry
    `name` (required), `command`/`args`/`env`/`cwd` for stdio, `type: sse`/`streamable-http`
    + `url` for remote, plus client-specific `requestOptions` and `connectionTimeout`.
    https://docs.continue.dev/reference
  - MCP deep dive — project blocks live in `.continue/mcpServers/` as standalone
    YAML files with required `name`/`version`/`schema` metadata; JSON MCP config
    files (Claude Desktop/Cursor/Cline shape) dropped into that folder are also
    picked up. https://docs.continue.dev/customize/deep-dives/mcp
  - Rules — markdown files in `.continue/rules/` (global `~/.continue/rules` applies
    across workspaces), loaded in lexicographical order.
    https://docs.continue.dev/customize/deep-dives/rules
  - `cn` CLI resolves `~/.continue/config.yaml` by default.
    https://docs.continue.dev/cli/configuration
- Real data: npm downloads for agentmove-cli remain 131 (08-04) / 1607 (08-05);
  Continue is one of the most widely used open-source coding agents (IDE
  extensions + CLI) still missing from the matrix.

## Gap (P1)

Continue users could not migrate MCP servers or rules in or out of AgentMove's
19-client matrix. Continue's list-shaped `mcpServers` and standalone project
blocks need dedicated handling (name-keyed list merge, required block metadata).

## Implementation

- `src/adapters/continue.ts`: user scope — parse/render the `mcpServers` list in
  `~/.continue/config.yaml` (streamable-http ↔ portable http; imported headers →
  `requestOptions.headers`), name-keyed merge preserving other config keys,
  `--replace-mcp` support, fresh configs get required `name`/`version`/`schema`,
  rules read/write in `~/.continue/rules/` (merged with `<!-- rule: ... -->`
  markers + warning). Honest warnings: `requestOptions`/`connectionTimeout`
  client-specific, no disabled flag, no SKILL.md skills, no durable memory,
  YAML comments lost on rewrite.
- `src/project.ts`: project scope — export `.continue/mcpServers/*.yaml` blocks
  (and JSON `mcpServers` maps) + `.continue/rules/`; import writes
  `.continue/mcpServers/agentmove.yaml` (valid standalone block) +
  `.continue/rules/agentmove.md`.
- Matrix expanded to 20×20; round-trip targets include continue.

## Verification

- build / lint / typecheck green; website build green.
- 21 test files, 118 tests green; branch coverage 65.89% (≥65% gate).
- New unit tests: list export, streamable-http/sse parsing, client-specific
  warnings, rules merge, list merge + replace semantics, fresh-config metadata,
  project blocks.
