# GAP-ROUND-137: Continue block directories are walked recursively

## Gap

Rounds 134–136 read Continue local block files (`.continue/mcpServers/`,
`.continue/prompts/*.yaml`, `.continue/rules/*.yaml`) from the top level of
each directory only. Continue itself walks these directories recursively:

Source (continuedev/continue):

- `core/config/loadLocalAssistants.ts` — `getDefinitionFilesInDir()` uses
  `walkDir(dir, ide, { overrideDefaultIgnores, ... })` for every block-type
  directory reached through `getAllDotContinueDefinitionFiles()` (used by
  `loadYaml.ts` for all `BLOCK_TYPES`, including `mcpServers`, `prompts`,
  `rules`).
- `core/context/mcp/json/loadJsonMcpConfigs.ts` — the JSON MCP loader also
  `walkDir`s `~/.continue/mcpServers` and workspace `.continue/mcpServers`
  before filtering to `*.json`.
- `walkDir` skips `DEFAULT_IGNORE_DIRS` (node_modules, .git, etc.).

So a server defined in `~/.continue/mcpServers/team/db.yaml` was loaded by
Continue but silently ignored by AgentMove.

## Fix (this round)

`listContinueBlockFiles()` in `adapters/continue.ts` recursively lists block
directory files sorted by relative path (skipping dot-dirs and node_modules),
and both `readContinueMcpBlockServers()` (YAML + JSON, user and project scope)
and `readContinueYamlBlocks()` (prompts/rules blocks, user and project scope)
now use it. Single-server JSON files keep upstream naming (basename minus
`.json`), and warning rel labels include the subpath. Duplicate precedence
(config.yaml first, then block files in sorted relative-path order) and import
destinations are unchanged.

## Deferred (with evidence)

- Markdown prompt/rule/skill discovery already had its own recursion; nothing
  further deferred for local file loading.
- Hub `uses:` references and remote block resolution remain out of scope.

## Test coverage

`test/continue.test.ts` — "discovers block files recursively in nested
subdirectories": nested YAML mcpServers block, nested single-server JSON
(name = basename), nested prompts YAML block.
