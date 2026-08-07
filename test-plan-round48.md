# Test Plan — PR #82 Round 48: Amazon Q Developer CLI adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied to temp homes.
Grounding: src/adapters/amazonq.ts — `mcpServers` map in ~/.aws/amazonq/mcp.json (L29,44); CLIENT_KEYS timeout/oauth/oauthScopes warnings (L31,51-55); disabled↔enabled:false (L50,71); render explicit type + sse→http with warning (L66-70); user-level instructions/persona/memory/skills all warned+skipped (L115-128). project.ts:988-1024 — project .amazonq/mcp.json merge + AmazonQ.md; persona/memory/skills warned.
Fixture amazonq-home: fetch stdio (FETCH_API_KEY, timeout:60000) + postgres stdio disabled:true + internal http (Authorization, oauthScopes:[]).

## T1: doctor
- `--home <amazonq-home copy> doctor` → `✓ Amazon Q Developer CLI (amazonq) — 3 MCP server(s), 0 skill(s), 0 memory entr(ies)` with warnings `mcp:fetch: amazonq timeout setting is client-specific; not migrated` and `mcp:internal: amazonq oauthScopes setting is client-specific; not migrated`.

## T2: export amazonq dry-run + bundle
- `export amazonq -o <tmp>` → exit 0; warnings incl. `mcp:fetch.env.FETCH_API_KEY` and `mcp:internal.headers.Authorization` redactions; bundle mcp-servers.json has `${FETCH_API_KEY}` / `${Authorization}` and `postgres` with `"enabled": false`; nothing written to the home copy (mtime/diff check).

## T3: openclaw→amazonq --apply (openclaw-home copy + pre-seeded fixture .aws/amazonq)
- Exit 0; mcp.json merge keeps `fetch` (timeout:60000 + real key intact), `postgres` (disabled:true intact), `internal` (oauthScopes:[] intact); adds `docs` explicit `"type": "stdio"` + `remote` (openclaw sse/http) written with `"type": "http"` + redacted Authorization; sse warning if remote is sse.
- No AGENTS.md/AmazonQ.md or other files written to home; warnings for instructions/persona/memory/skills all emitted; automatic backup under `<home>/.agentmove/backups/`.

## T4: --replace-mcp
- Same setup; mcpServers becomes ONLY imported servers with `removed by --replace-mcp` warnings for fetch/postgres/internal.

## T5: project-level convert claude-code amazonq --project --apply
- claude-project copy + pre-seed `<proj>/.amazonq/mcp.json` `{"mcpServers": {"existing": {"command": "echo"}}}`. Pass: merged `.amazonq/mcp.json` keeps `existing` + adds search (type stdio) + api (type http redacted); `AmazonQ.md` written with project instructions.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 26 files / 137 tests; record actual).
- `export amazonqq -o /tmp/x48` → exit 2, list includes `amazonq`, `did you mean "amazonq"?`.
