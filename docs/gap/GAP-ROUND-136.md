# GAP-ROUND-136: Continue JSON MCP block file formats (full loader matrix)

## Gap

Round 135 added `~/.continue/mcpServers/` block-file reads, but the JSON path
only accepted claude-style name-keyed `mcpServers` maps parsed with strict
`JSON.parse`. Continue's own JSON loader accepts more:

Source: `core/context/mcp/json/loadJsonMcpConfigs.ts` +
`packages/config-yaml/src/schemas/mcp/json.ts` (continuedev/continue).

1. **JSONC**: files are parsed with `comment-json` (`JSONC.parse`), so
   comments are legal.
2. **claude-code style files** (`claudeCodeLikeConfigFileSchema`): a top-level
   `mcpServers` map (optional) plus a `projects` record whose entries each
   carry their own optional `mcpServers` map — all of them are loaded.
3. **single-server files** (`mcpServersJsonSchema`): a bare stdio
   (`command`/`args`/`env`/`envFile`) or remote (`url`/`type`/`headers`)
   object with no `mcpServers` key; the server name is the filename minus
   `.json` (`getUriPathBasename(uri).replace(".json", "")`).
4. **unsupported formats** produce an explicit error message:
   `doesn't match a supported MCP JSON configuration format`.
5. `envFile` on stdio JSON configs is dropped with a warning by
   `convertJsonMcpConfigToYamlMcpConfig`.

## Fix (this round)

`parseContinueJsonBlock()` in `adapters/continue.ts` now mirrors the loader:
JSON block files are parsed with JSON5 (comment-tolerant), claude-code
`projects` nesting is walked, single-server files are named after the file,
`envFile` emits an explicit not-migrated warning, and unsupported shapes emit
`mcp: <rel> does not match a supported MCP JSON configuration format; skipped`.
The user and project adapters share this path (the reader now takes the
directory's rel label for warnings). config.yaml-first duplicate precedence
and import behavior are unchanged.

## Deferred (with evidence)

- Upstream `walkDir`s the mcpServers dirs recursively; AgentMove still reads
  the top-level directory only (matching the round-135 YAML behavior).
- Upstream deduplicates JSON configs by name before merging; AgentMove's
  `mergeContinueMcpServers` first-wins handles this with per-entry warnings.
- Hub `uses:` references and remote block resolution remain out of scope.

## Test coverage

`test/continue.test.ts` — "parses claude-code projects nesting, single-server
files, jsonc, and unsupported formats": projects nesting loaded, single-server
name = filename with a `//` comment in the file, `envFile` warning verbatim,
unsupported-format warning verbatim.
