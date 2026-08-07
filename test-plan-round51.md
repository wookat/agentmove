# Test Plan — PR #88 Round 51: LM Studio adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied into temp homes.
Grounding: src/adapters/lmstudio.ts — `~/.lmstudio/mcp.json` mcpServers map (L28,41); entries render with NO type field (renderCommonMcpEntry(...,false) L66); enabled:false warned "no disabled flag ... emitted as enabled" (L56-60); sse warned "written without a transport type" (L61-65); instructions/persona/memory/skills all skipped with warnings (L107-116); no project adapter registered (grep of project.ts confirms MCP-only client).
Fixture lmstudio-home: playwright stdio (PLAYWRIGHT_API_KEY) + hf-mcp-server url (Authorization).

## T1: doctor
- `--home <lmstudio-home copy> doctor` → `✓ LM Studio (lmstudio) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: no, persona: no`, no warnings.

## T2: export lmstudio
- Exit 0; redaction warnings `mcp:playwright.env.PLAYWRIGHT_API_KEY` and `mcp:hf-mcp-server.headers.Authorization`; bundle has `${PLAYWRIGHT_API_KEY}` / `${Authorization}`; home copy diff-identical (no writes).

## T3: convert openclaw lmstudio --apply (openclaw-home copy + lmstudio fixture .lmstudio in same home)
- Exit 0; merged `.lmstudio/mcp.json` keeps `playwright` (real key) + `hf-mcp-server` untouched; adds `docs` (stdio, NO type key) + `remote` (plain url, NO type key, redacted Authorization).
- Only `.lmstudio/mcp.json` written (plus backup under `.agentmove/backups/`); all 4 skip warnings emitted (instructions app-managed presets / persona / memory / skills).

## T4: --replace-mcp
- Same setup; mcpServers becomes ONLY docs+remote with `removed by --replace-mcp` warnings for playwright/hf-mcp-server.

## T5 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 29 files / 148 tests; record actual).
- `export lmstudi -o /tmp/x51` → exit 2, list includes `lmstudio`, `did you mean "lmstudio"?`.
