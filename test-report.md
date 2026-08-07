# Test Report — Round 60: Nanocoder adapter (PR #106, 36th client)

**Date:** 2026-08-07
**Branch:** `devin/1786082046-round-60-nanocoder` (`ac2eb17 Round 60: Nanocoder adapter (36th client)`)
**Method:** built CLI (`pnpm --filter agentmove-cli build`, `node packages/agentmove/dist/cli.js`) run against fixture copies in `mktemp -d` temp homes/projects. Shell-only, no recording. Never touched real agent data.
**Plan:** `test-plan-round60.md`

## Summary

All 7 requested checks **passed**. Full suite green: **38 files / 193 tests**.

Nanocoder semantics verified: user-scope MCP at `~/.config/nanocoder/.mcp.json` (`mcpServers` map, explicit `transport` field); websocket transport skipped on export with warning; `enabled:false` round-trips; `timeout`/`alwaysAllow` client-specific warnings + preserved on merge; user-scope instructions/persona/skills/memory all warn+skip (instructions warning points to `--project`); project scope uses `.mcp.json` + root `AGENTS.md` with persona approximation.

## T1: clients / doctor — PASSED
```
nanocoder       Nanocoder               ~/.config/nanocoder/.mcp.json
✓ Nanocoder (nanocoder) — 2 MCP server(s), 0 skill(s), 0 memory entr(ies), instructions: no, persona: no
    ! mcp:filesystem: nanocoder alwaysAllow setting is client-specific; not migrated
    ! mcp:api-server: nanocoder timeout setting is client-specific; not migrated
```

## T2: export nanocoder (redaction, no writes) — PASSED
- Warnings redact both secrets; bundle `mcp-servers.json`:
  - `filesystem`: `transport:"stdio"`, command/args, `env.FS_API_KEY = "${FS_API_KEY}"`
  - `api-server`: `transport:"http"`, url, `headers.Authorization = "${Authorization}"`
- Home copy `diff -r`-identical to fixture after export → no writes.

## T3: nanocoder→codex dry-run — PASSED
- Exit 0, `dry-run: would write 1 file(s) ... ~/.codex/config.toml`; home `diff -r`-identical afterwards → no writes.

## T4: convert openclaw nanocoder --apply — PASSED
- Existing `filesystem` preserved verbatim incl. `alwaysAllow` + real env token; `api-server` preserved incl. `timeout: 30000`.
- Imported `docs` = `{"transport":"stdio","command":"npx","args":[...]}` (no url/cwd); imported `remote` = `{"transport":"http","url":"https://example.com/mcp","headers":{"Authorization":"${Authorization}"}}`.
- Warnings, all present:
  ```
  instructions: nanocoder reads AGENTS.md from the project root only; use --project
  persona: nanocoder has no persona file; skipped (use --project for AGENTS.md)
  memory: nanocoder has no durable memory store; skipped (consider --mif)
  skills: nanocoder skills use their own skill.yaml bundle format, not the Agent Skills standard; skipped
  ```
- Only `.config/nanocoder/.mcp.json` written (plus backup) — no AGENTS.md or skills anywhere; automatic backup at `.agentmove/backups/2026-08-07T05-57-21-536Z/.config/nanocoder/.mcp.json`.

## T5: websocket skip + enabled:false round-trip — PASSED
- Seeded home with `ws` (websocket) and `off` (stdio, `enabled:false`):
  - Export warns `mcp:ws: nanocoder websocket transport has no portable equivalent; skipped`; bundle contains only `off` with `"enabled": false`.
  - Import into fresh home writes `off` with `"enabled": false` (native round-trip).

## T6: project scope — PASSED
- `export nanocoder --project <src>` parsed `.mcp.json` (2 servers, Authorization redacted) + root `AGENTS.md` instructions.
- Import (bundle augmented with `persona.md`) into target seeded with `.mcp.json` `existing` (`timeout: 9000`) + root `AGENTS.md`:
  - Merge kept `existing` verbatim; added `search` (stdio) + `api` (http, `${Authorization}`).
  - `AGENTS.md` = instructions + `## Imported by agentmove: persona (SOUL.md)` section, warning `persona: appended to AGENTS.md (approximated)`.
  - Backup contains both `.mcp.json` and `AGENTS.md`.
- `--replace-mcp` on fresh target → `mcp:existing: removed by --replace-mcp`; `existing` gone.
- Methodology note: first persona attempt used a `SOUL.md` file in the bundle dir, which is ignored — the bundle persona file is `persona.md` (src/bundle.ts). Retested correctly; not a product bug.

## T7: typo regression — PASSED
- `export nanocder` → exit 2; list ends `..., grok, vibe, nanocoder`; `did you mean "nanocoder"?`.

## Full suite — PASSED
```
Test Files  38 passed (38)
Tests       193 passed (193)
```
