# GAP-ROUND-51 — LM Studio adapter (27th client)

## Research trigger

Competitor/ecosystem scan after 0.24.0 (Junie). LM Studio is the dominant
local-LLM desktop app and gained MCP support in 0.3.17; users migrating
between cloud agents and local setups need to carry their MCP servers over.

## Official format (verified sources)

- lmstudio.ai/docs/app/mcp and lmstudio.ai/blog/lmstudio-v0.3.17: MCP servers
  configured in `mcp.json`, which "follows Cursor's `mcp.json` notation" —
  an `mcpServers` map, stdio entries with `command`/`args`/`env`, remote
  entries with `url`/`headers`. File lives at `~/.lmstudio/mcp.json` on
  macOS/Linux and `%USERPROFILE%/.lmstudio/mcp.json` on Windows (same
  home-relative path — no platform branching needed).
- No documented `disabled` flag or `type` field; server processes are spawned
  from the file on save. Everything else (system prompts/presets, chats,
  models) is app-managed with no documented file format for interchange.

## Implementation

- `lmstudio` client (user level): `~/.lmstudio/mcp.json` (`mcpServers`,
  common entry shape, rendered without `type`). Merge by name, `--replace-mcp`,
  secret redaction. No disabled flag (warned); imported SSE written as plain
  `url` entries (warned); instructions/persona/memory/skills skipped with
  warnings. No project scope.
- 27×27 conversion matrix + round-trip e2e; fixture `lmstudio-home`.

## Gaps / deferred

- LM Studio presets (`.preset.json`) could theoretically carry a system
  prompt, but the format is app-managed and undocumented for interchange —
  deferred until officially documented.

## Verification

- `pnpm build`, `pnpm -w lint`, typecheck green.
- Full suite green (docs-sync guard forced README/website/man updates).
- Website build green.
