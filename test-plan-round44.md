# Test Plan — PR #76 Round 44: Antigravity adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied to temp homes.
Grounding: src/adapters/antigravity.ts — `mcpServers` map in ~/.gemini/config/mcp_config.json (L32,58); serverUrl→url normalize on parse (L45-52); render emits serverUrl not url (L82-84); disabled↔enabled:false (L64,84-86); CLIENT_KEYS disabledTools/authProviderType/oauth warnings (L35,65-71); skills ~/.gemini/config/skills (L33); user-scope instructions GEMINI.md-shared warnings (L132-134,154-158); persona/memory skipped warnings (L159-164). project.ts:906-945 — project .agents/mcp_config.json merge + .agents/rules/agentmove.md + .agents/skills.
Fixture antigravity-home: sqlite-explorer stdio (API_KEY, disabledTools) + remote-api serverUrl+Authorization+disabled:true + gcp-service serverUrl+authProviderType; skills/review.

## T1: doctor
- `--home <antigravity-home copy> doctor` → `✓ Antigravity (antigravity) — 3 MCP server(s), 1 skill(s), 0 memory entr(ies)` with warnings `mcp:sqlite-explorer: antigravity disabledTools setting is client-specific; not migrated`, `mcp:gcp-service: antigravity authProviderType setting is client-specific; not migrated`, and the GEMINI.md instructions note.

## T2: convert antigravity codex dry-run + bundle
- Exit 0; warnings incl. `mcp:sqlite-explorer.env.API_KEY` and `mcp:remote-api.headers.Authorization` redactions; nothing written.
- Export bundle mcp-servers.json: `remote-api` transport `"http"` with url `https://api.example.com/mcp/` and `"enabled": false`; `gcp-service` transport http with url (serverUrl normalized, no serverUrl key in bundle).

## T3: openclaw→antigravity --apply (openclaw-home copy + pre-seeded fixture .gemini/config)
- Exit 0; mcp_config.json merge keeps `sqlite-explorer` (disabledTools + real API_KEY intact), `remote-api` (serverUrl + disabled:true intact), `gcp-service` (authProviderType intact); adds `docs` (stdio, command/args) + `remote` with `serverUrl` key (NO `url` key) + redacted Authorization.
- Skill at `.gemini/config/skills/todo/SKILL.md` (existing review kept); warnings: instructions GEMINI.md-shared note, `persona: antigravity has no persona file; skipped`, `memory: antigravity has no durable memory store; skipped`.

## T4: --replace-mcp
- Same setup; `convert openclaw antigravity --apply --replace-mcp` → mcpServers contains ONLY docs+remote; warnings `mcp:sqlite-explorer: removed by --replace-mcp` (also remote-api, gcp-service).

## T5: project-level convert claude-code antigravity --project --apply
- claude-project copy + pre-seed `<proj>/.agents/mcp_config.json` `{"mcpServers": {"existing": {"command": "echo"}}}` and `<proj>/.agents/rules/00-old.md`. Pass: merged mcp_config.json keeps `existing` + adds search (stdio) + api (serverUrl, redacted); `.agents/rules/agentmove.md` written with project instructions (00-old.md untouched); `.agents/skills/review/SKILL.md` written.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → 23 files / 126 tests passed.
- `export antigravty -o /tmp/x44` → exit 2, list includes `antigravity`, `did you mean "antigravity"?`.
