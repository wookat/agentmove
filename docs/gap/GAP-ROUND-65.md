# GAP ROUND-65: LibreChat adapter (39th client)

## Candidate research

### Selected: LibreChat (danny-avila/LibreChat)

- Self-hosted AI chat platform (~30k stars), one of the largest deployed
  open-source LLM front ends.
- MCP servers are configured in the deployment's `librechat.yaml` under
  `mcpServers` — documented at
  https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
  and https://www.librechat.ai/docs/features/mcp.
- Format (per official docs):
  - stdio: `type: stdio` (or omitted with `command`), `command`, `args`, `env`.
  - remote: `url` plus `type: sse`, `type: streamable-http`, or
    `type: websocket`; omitted `type` defaults by url scheme — http(s) → SSE,
    ws(s) → websocket.
  - Client-specific keys: `timeout`, `initTimeout`, `serverInstructions`,
    `iconPath`, `chatMenu`, `customUserVars`, `requiresOAuth`, `oauth`,
    `proxy`.
- Custom prompts, agents, and memory are stored in the app database
  (MongoDB) — app-managed, not migratable as files.

### Scope decision

`librechat.yaml` is per-deployment, not per-user, so the adapter is
project-scoped: run `--project` in the LibreChat deployment directory. The
user-scope adapter is warnings-only (points at `--project`), the same shape
as Trae's app-managed user scope. Excluded from the user-scope e2e matrix
for the same reason (covered by dedicated tests).

### Behavior

- Export: parse `mcpServers`; websocket entries skipped (warned);
  client-specific keys warned; secrets redacted by default.
- Import: merge by name (`--replace-mcp` to replace), preserve all other
  YAML keys (`version`, `cache`, `endpoints`, ...), write explicit
  `type: stdio`/`sse`/`streamable-http`; no disabled flag (warned); `cwd`
  dropped (warned); YAML comments not preserved on rewrite (warned).
- instructions/persona/memory/skills: app-managed (database) — skipped with
  warnings.

## Deferred / rejected this round

- **5ire** (nanbingxyz/5ire): current main is migrating MCP servers from
  `{userData}/mcp.json` into a SQLite database
  (`src/main/services/legacy-data-migrator.ts` +
  `legacy-servers-config-loader.ts` mark the JSON file as legacy). The file
  surface is being deprecated, so an adapter would break on upcoming
  releases. Revisit if a stable user-editable config file returns.
- **Witsy**: MCP config is split across `settings.json` sections
  (`mcp.servers[]`, `mcpServers{}` Smithery format, `mcp.mcpServersExtra{}`)
  inside the app's monolithic settings file — high risk of clobbering
  app-managed state; deferred.

## Deferred edges

- LibreChat `customUserVars` per-user values and OAuth tokens live in the
  database; only the yaml declaration is preserved on merge.
- Docker deployments that mount `librechat.yaml` from a non-project path are
  not followed; run `--project` against the directory containing the file.
