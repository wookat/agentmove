# Test Plan — PR #86 Round 50: Junie (JetBrains) adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied into temp homes.
Grounding: src/adapters/junie.ts — `~/.junie/mcp/mcp.json` mcpServers map (L32,47); entries render with NO type field (renderCommonMcpEntry(...,false) L70); enabled:false warned "no disabled flag ... emitted as enabled" (L60-64); sse warned "written without a transport type" (L65-69); instructions ~/.junie/AGENTS.md (L33,92,118-120) with persona appended approximated (L114-117); skills ~/.junie/skills direct (L34,93,124); memory skipped warning (L121-123). project.ts:1028-1066 — project .junie/mcp/mcp.json merge, instructions export fallbacks .junie/AGENTS.md → AGENTS.md → .junie/guidelines.md (L1035-1038), import writes .junie/AGENTS.md (L1057) + .junie/skills (L1063).
Fixture junie-home: context7 stdio (CONTEXT7_API_KEY) + internal url (Authorization); .junie/AGENTS.md; skill review-helper.

## T1: doctor
- `--home <junie-home copy> doctor` → `✓ Junie (junie) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export junie
- Exit 0; redaction warnings `mcp:context7.env.CONTEXT7_API_KEY` and `mcp:internal.headers.Authorization`; bundle has `${CONTEXT7_API_KEY}` / `${Authorization}`; instructions.md = fixture .junie/AGENTS.md content; skills/review-helper/SKILL.md present in bundle; home copy diff-identical (no writes).

## T3: convert openclaw junie --apply (openclaw-home copy + junie fixture .junie in same home)
- Exit 0; merged `.junie/mcp/mcp.json` keeps `context7` (real key) + `internal` untouched; adds `docs` (stdio, NO type key) + `remote` (plain url, NO type key, redacted Authorization).
- `.junie/AGENTS.md` overwritten with openclaw instructions + `persona (SOUL.md)` section; warning `persona: junie has no persona file; appended to ~/.junie/AGENTS.md (approximated)`; skill `.junie/skills/todo/SKILL.md` written (review-helper kept); warning `memory: junie has no durable memory store; skipped`; backup under `.agentmove/backups/`; only mcp.json + AGENTS.md + skills written.

## T4: --replace-mcp
- Same setup; mcpServers becomes ONLY docs+remote with `removed by --replace-mcp` warnings for context7/internal.

## T5: project scope
- Export: temp project with pre-seeded `.junie/mcp/mcp.json` + legacy `.junie/guidelines.md` (no AGENTS.md) → `export junie --project` bundle instructions = guidelines.md content.
- Import: `convert claude-code junie --project <claude-project copy pre-seeded with .junie/mcp/mcp.json {"mcpServers":{"existing":{"command":"echo"}}}> --apply` → merged mcp.json keeps `existing`, adds `search` (stdio no type) + `api` (url redacted); `.junie/AGENTS.md` written = "# Project instructions / Use pnpm."; `.junie/skills/review/SKILL.md` written.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 28 files / 145 tests; record actual).
- `export juni -o /tmp/x50` → exit 2, list includes `junie`, `did you mean "junie"?`.
