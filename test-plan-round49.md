# Test Plan — PR #84 Round 49: Warp adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied into temp homes.
Grounding: src/adapters/warp.ts — `~/.warp/.mcp.json` (L30); WRAPPER_KEYS mcpServers/mcp_servers/servers, existing wrapper key preserved on merge (L32,41-46,112-115); working_directory↔portable cwd (L58-60,78-81); render entries with NO type field (renderCommonMcpEntry(...,false) L77); enabled:false warned + emitted enabled (L69-71); sse warned "auto-negotiate transport" (L72-76); instructions/persona/memory/skills skipped with warnings (L125-138). project.ts:1027-1067 — .warp/.mcp.json merge + AGENTS.md write (WARP.md legacy read on export).
Fixture warp-home: fetch stdio (FETCH_API_KEY, working_directory:/tmp/fetch-home) + internal url (Authorization).

## T1: doctor
- `--home <warp-home copy> doctor` → `✓ Warp (warp) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies)` and NO client-specific warnings.

## T2: export warp
- Exit 0; redaction warnings for `mcp:fetch.env.FETCH_API_KEY` and `mcp:internal.headers.Authorization`; bundle mcp-servers.json: fetch has `"cwd": "/tmp/fetch-home"` and `${FETCH_API_KEY}`; internal transport http with `${Authorization}`; home copy diff-identical to fixture (no writes).

## T3: convert openclaw warp --apply (openclaw-home copy + warp fixture .warp in same temp home)
- Exit 0; merged `.warp/.mcp.json` keeps `fetch` (working_directory + real key) and `internal` untouched; adds `docs` (stdio, NO type key) and `remote` (plain url entry, NO type key, redacted Authorization).
- Only `.warp/.mcp.json` written (plus backup under `.agentmove/backups/`); all 4 skip warnings (instructions Warp Drive / persona / memory / skills) emitted.

## T4: --replace-mcp
- Same setup; mcpServers becomes ONLY docs+remote with `removed by --replace-mcp` warnings for fetch/internal.

## T5: alternate wrapper key
- Fresh home with `.warp/.mcp.json` = `{"mcp_servers": {"existing": {"command": "echo"}}}`; import/convert openclaw→warp --apply. Pass: file's top-level key remains `mcp_servers`, contains existing + docs + remote; no `mcpServers` key added.

## T6: project-level convert claude-code warp --project --apply
- claude-project copy + pre-seed `<proj>/.warp/.mcp.json` `{"mcpServers": {"existing": {"command": "echo"}}}`. Pass: merged file keeps `existing`, adds `search` (stdio no type) + `api` (url, redacted); `AGENTS.md` written = "# Project instructions / Use pnpm."

## T7 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 27 files / 141 tests; record actual).
- `export warpp -o /tmp/x49` → exit 2, list includes `warp`, `did you mean "warp"?`.
