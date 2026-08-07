# Test Plan — PR #68 Round 40: Kiro adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js`. Fixtures copied to temp dirs. Evidence: outputs + exit codes + file contents.
Grounding: adapters/kiro.ts — `mcpServers` root key with native `disabled` flag (parse: disabled→enabled:false; render: enabled:false→disabled:true); CLIENT_KEYS (autoApprove etc.) warn "client-specific; not migrated"; readSteering merges AGENTS.md + other *.md with "steering files merged" warning; skills via ~/.kiro/skills. project.ts:694-734 — project scope `.kiro/settings/mcp.json` + `.kiro/steering/AGENTS.md` + `.kiro/skills`.

## T1: doctor detects kiro
- `--home <kiro-home copy> doctor` → `✓ Kiro (kiro) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: convert kiro codex (dry-run) + bundle proof
- Exit 0; warnings include: `web-search.env.BRAVE_API_KEY` redaction, `internal.headers.Authorization` redaction, `mcp:web-search: kiro autoApprove setting is client-specific; not migrated`, `instructions: kiro steering files merged into one document...`; nothing written.
- Export bundle: mcp-servers.json shows `internal` with `"enabled": false` (disabled preserved portably); instructions.md contains both AGENTS.md content and `<!-- steering: style.md -->` section with front matter kept. Record how codex represents the disabled server (warning text) as-is.

## T3: convert openclaw kiro --apply (openclaw-home copy, pre-seed fixture mcp.json)
- Pass: exit 0; `.kiro/settings/mcp.json` keeps `web-search` (with autoApprove intact) + `internal` (disabled:true intact), adds `docs` (stdio) + `remote` (url, redacted Authorization); `.kiro/steering/AGENTS.md` written with instructions + persona approximation; skill at `.kiro/skills/todo/SKILL.md`; warning `memory: kiro has no durable memory store; skipped`.
- Extra: import a bundle containing a disabled server? (covered implicitly only if openclaw has one — it doesn't; instead verify render path via kiro→kiro-like check in T2 bundle. Acceptable: verify disabled:true retained on existing `internal`.)

## T4: project-level convert claude-code kiro --project --apply
- claude-project copy + empty temp home. Pass: exit 0; `<proj>/.kiro/settings/mcp.json` (mcpServers: search stdio + api url redacted); `<proj>/.kiro/steering/AGENTS.md` with project instructions; `<proj>/.kiro/skills/review/SKILL.md`.

## T5: unit tests
- `pnpm --filter agentmove-cli test` → 109/109 passed.

## T6 (Regression): client list + typo
- `export kiroo -o /tmp/x` → exit 2, list includes `kiro`, `did you mean "kiro"?`.
