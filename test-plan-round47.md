# Test Plan — PR #80 Round 47: Droid adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied to temp homes.
Grounding: src/adapters/droid.ts — `mcpServers` map in ~/.factory/mcp.json (L32,49); render explicit type (renderCommonMcpEntry(..., true) L70); disabled↔enabled:false (L55,71); CLIENT_KEYS disabledTools/timeout/connectTimeout/oauth warnings (L36,56-60); instructions ~/.factory/AGENTS.md round-trip (L33,94,120-121); persona appended to AGENTS.md approximated (L116-118); memory skipped (L123-125); skills ~/.factory/skills (L34). project.ts:948-985 — project .factory/mcp.json merge + AGENTS.md at root (export falls back to .factory/AGENTS.md) + .factory/skills.
Fixture droid-home: airtable stdio (AIRTABLE_API_KEY, disabledTools) + linear http disabled:true + internal http (Authorization, oauth:false); .factory/AGENTS.md; skills/review.

## T1: doctor
- `--home <droid-home copy> doctor` → `✓ Droid (droid) — 3 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes` with warnings `mcp:airtable: droid disabledTools setting is client-specific; not migrated` and `mcp:internal: droid oauth setting is client-specific; not migrated`.

## T2: convert droid codex dry-run + bundle
- Exit 0; warnings incl. `mcp:airtable.env.AIRTABLE_API_KEY` and `mcp:internal.headers.Authorization` redactions; nothing written.
- Export bundle mcp-servers.json: `linear` transport http with `"enabled": false`; instructions.md = "# Personal conventions / Always use pnpm."

## T3: openclaw→droid --apply (openclaw-home copy + pre-seeded fixture .factory)
- Exit 0; mcp.json merge keeps `airtable` (disabledTools + real key intact), `linear` (disabled:true intact), `internal` (oauth:false intact); adds `docs` with explicit `"type": "stdio"` + `remote` explicit `"type": "http"` + redacted Authorization.
- `.factory/AGENTS.md` overwritten with openclaw instructions + `## Imported by agentmove: persona (SOUL.md)`; warning persona approximated; skill `.factory/skills/todo/SKILL.md` (review kept); warning `memory: droid has no durable memory store; skipped`.

## T4: --replace-mcp
- Same setup; mcpServers becomes ONLY docs+remote with `removed by --replace-mcp` warnings for airtable/linear/internal.

## T5: project-level convert claude-code droid --project --apply
- claude-project copy + pre-seed `<proj>/.factory/mcp.json` `{"mcpServers": {"existing": {"command": "echo"}}}`. Pass: merged `.factory/mcp.json` keeps `existing` + adds search (type stdio) + api (type http redacted); root `AGENTS.md` = "# Project instructions / Use pnpm."; `.factory/skills/review/SKILL.md` written.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect ~24 files / 130 tests; record actual count).
- `export droidd -o /tmp/x47` → exit 2, list includes `droid`, `did you mean "droid"?`.
