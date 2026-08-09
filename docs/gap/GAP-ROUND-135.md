# GAP-ROUND-135: Continue user-level MCP block files (`~/.continue/mcpServers/`)

## Gap

Continue loads MCP servers not only from the `mcpServers:` list in
`~/.continue/config.yaml` but also from local block files in
`~/.continue/mcpServers/` (and workspace `.continue/mcpServers/`):

- YAML block files carrying an `mcpServers:` list (config.yaml schema), and
- JSON files in claude-style formats (name-keyed `mcpServers` maps and
  single-server files).

AgentMove's project adapter already read `.continue/mcpServers/*`, but the
user-level adapter read only `config.yaml`, silently omitting any server the
user had defined as a global block file.

## Upstream evidence (continuedev/continue @ main, 2026-08)

- `packages/config-yaml/src/load/getBlockType.ts` — `BLOCK_TYPES` includes
  `"mcpServers"`.
- `core/config/yaml/loadYaml.ts` — for every block type, local YAML block
  files are gathered with
  `getAllDotContinueDefinitionFiles(ide, { includeGlobal: true, includeWorkspace: true, fileExtType: "yaml" }, blockType)`
  and merged into the unrolled config; later
  `loadJsonMcpConfigs(ide, true, ...)` appends JSON-defined servers:
  ```ts
  const mcpOptions: InternalMcpOptions[] = (config.mcpServers ?? []).map(...);
  const { errors: jsonMcpErrors, mcpServers } = await loadJsonMcpConfigs(ide, true, config.requestOptions);
  mcpOptions.push(...mcpServers);
  ```
- `core/context/mcp/json/loadJsonMcpConfigs.ts` — "Loads MCP configs from
  JSON files in ~/.continue/mcpServers and workspace .continue/mcpServers";
  supports claude-code-like files (`mcpServers` map + nested `projects`),
  claude-desktop-like files, and single-server JSON files; deduplicates by
  name (first wins).

## AgentMove behavior after this round

- User export reads `~/.continue/mcpServers/`:
  - `*.yaml` / `*.yml`: entries of the file's `mcpServers:` list, parsed with
    the same schema as `config.yaml` (incl. `streamable-http` → `http`
    normalization and client-specific key warnings).
  - `*.json`: claude-style name-keyed `mcpServers` maps via the common parser.
- Duplicate names: `config.yaml` entries win; each shadowed block-file entry
  emits `mcp:<name>: entry in .continue/mcpServers shadowed by an existing
  server with the same name; skipped`.
- The project adapter now shares the same reader (`readContinueMcpBlockServers`)
  and gains the same first-wins duplicate handling with warnings.
- Imports are unchanged: user scope merges into `config.yaml`'s `mcpServers:`
  list; project scope writes `.continue/mcpServers/agentmove.yaml`.

## Deferred (documented, warned where applicable)

- Claude-code-like JSON `projects` nesting and single-server JSON files
  (named by filename) — only name-keyed `mcpServers` maps are read, matching
  the pre-existing project-adapter behavior.
- Hub `uses:` MCP block references (remote registry) — not migrated.

## Test coverage

- `packages/agentmove/test/continue.test.ts` — user-level block export
  (yaml + json), config.yaml winning duplicates with the exact warning,
  `streamable-http` normalization; existing project-scope block test still
  covers `.continue/mcpServers` project reads.
