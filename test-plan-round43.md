# Test Plan — PR #74 Round 43: Crush adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied to temp homes.
Grounding: src/adapters/crush.ts — `mcp` MAP in ~/.config/crush/crush.json (L31,47); explicit type on render (renderCommonMcpEntry(..., true) L68); disabled↔enabled:false (L53,69); CLIENT_KEYS disabled_tools/timeout warnings (L34,54-58); skills ~/.config/crush/skills (L32); user-scope instructions/persona/memory warnings (L93-95,116-126). project.ts:858-899 — export .crush.json (wins) else crush.json, CRUSH.md ?? AGENTS.md, .crush/skills; import merges into existing file (.crush.json if present else crush.json), writes CRUSH.md + .crush/skills.
Fixture crush-home: filesystem stdio (API_KEY, timeout:120, disabled_tools) + github http (Authorization, disabled:true) + streaming sse; skills/review.

## T1: doctor
- `--home <crush-home copy> doctor` → `✓ Crush (crush) — 3 MCP server(s), 1 skill(s), 0 memory entr(ies)` with warnings `mcp:filesystem: crush timeout setting is client-specific; not migrated` + `mcp:filesystem: crush disabled_tools setting is client-specific; not migrated` (+ project-scoped-instructions note).

## T2: convert crush codex dry-run + bundle
- Exit 0; warnings incl. `mcp:filesystem.env.API_KEY` and `mcp:github.headers.Authorization` redactions; nothing written.
- Export bundle mcp-servers.json: `github` transport `"http"` with `"enabled": false`; `streaming` transport `"sse"`.

## T3: openclaw→crush --apply (openclaw-home copy + pre-seeded fixture .config/crush)
- Exit 0; crush.json merge keeps `filesystem` (timeout + disabled_tools intact, real API_KEY), `github` (disabled:true intact), `streaming`; adds `docs` with explicit `"type": "stdio"` and `remote` with explicit `"type": "http"` + redacted Authorization; `$schema` key preserved.
- Skill at `.config/crush/skills/todo/SKILL.md`; warnings: `instructions: crush reads context files per project; import with --project to write CRUSH.md`, `persona: crush has no persona file; skipped (use --project for CRUSH.md)`, `memory: crush has no durable memory store; skipped`.

## T4: --replace-mcp
- Same setup, `convert openclaw crush --apply --replace-mcp` → crush.json `mcp` contains ONLY docs+remote; warnings `mcp:filesystem: removed by --replace-mcp` (also github, streaming).

## T5: project-level convert claude-code crush --project --apply
- claude-project copy + pre-seed `<proj>/crush.json` with `{"mcp": {"existing": {"type": "stdio", "command": "echo"}}}` and a `CRUSH.md`. Pass: merged `crush.json` keeps `existing` + adds search (type stdio) + api (type http, redacted); `CRUSH.md` overwritten with "# Project instructions / Use pnpm."; `.crush/skills/review/SKILL.md` written; no `.crush.json` created.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → 22 files / 122 tests passed.
- `export crus -o /tmp/x43` → exit 2, list includes `crush`, `did you mean "crush"?`.
