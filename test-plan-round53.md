# Test Plan — PR #92 Round 53: CodeBuddy (Tencent) adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixtures copied into temp homes/projects.
Grounding: src/adapters/codebuddy.ts — MCP candidates `.codebuddy/.mcp.json` → `.codebuddy/mcp.json` → legacy `.codebuddy.json`, first existing wins and is rewritten in place (L35,39-53,100-101); `disabledMcpServers` name list ↔ portable enabled:false (L60-69,85,105-112: merge unions existing+imported disabled, replace uses imported only); imports render explicit type (renderCommonMcpEntry(...,true) L87); cwd dropped with warning (L86); instructions ~/.codebuddy/CODEBUDDY.md with persona appended approximated (L142,166-175); skills ~/.codebuddy/skills (L37,148,179); memory app-managed warning (L176-178). project.ts:1169-1216 — project reads/writes `.mcp.json` (fallback `mcp.json`), CODEBUDDY.md, `.codebuddy/skills`.
Fixture codebuddy-home: filesystem stdio (FS_API_KEY) + api-server http (Authorization) with disabledMcpServers:["api-server"]; CODEBUDDY.md; skill deploy-helper.

## T1: doctor
- `--home <codebuddy-home copy> doctor` → `✓ CodeBuddy (codebuddy) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export codebuddy
- Exit 0; redaction warnings `mcp:filesystem.env.FS_API_KEY` + `mcp:api-server.headers.Authorization`; bundle: api-server has `"enabled": false` (from disabledMcpServers); `${FS_API_KEY}`/`${Authorization}`; instructions.md = fixture CODEBUDDY.md; skills/deploy-helper in bundle; home copy diff-identical (no writes).

## T3: convert openclaw codebuddy --apply (openclaw-home copy + codebuddy fixture .codebuddy in same home)
- Exit 0; merged `.codebuddy/.mcp.json` keeps `filesystem` (real key) + `api-server` untouched; adds `docs` explicit `"type": "stdio"` + `remote` explicit `"type": "http"` (redacted Authorization); `disabledMcpServers` still contains `api-server` (imported servers all enabled → union unchanged).
- `.codebuddy/CODEBUDDY.md` = openclaw instructions + `## Imported by agentmove: persona (SOUL.md)`; persona-approximated warning; skill `.codebuddy/skills/todo/SKILL.md` (deploy-helper kept); `memory: codebuddy auto-memory is app-managed; skipped (consider --mif)`; backup created. (cwd-drop warning only if a bundle server has cwd — openclaw fixture has none; exercise cwd via warp bundle supplement if convenient, else note.)

## T4: legacy write path
- Fresh home with ONLY `~/.codebuddy.json` = `{"mcpServers": {"legacy": {"command": "echo"}}, "projects": {"/tmp/foo": {"x": 1}}}`; import/convert openclaw→codebuddy --apply. Pass: `.codebuddy.json` rewritten (contains legacy+docs+remote and preserved `projects` block); NO `.codebuddy/.mcp.json` created.

## T5: project scope
- claude-project copy + pre-seed `<proj>/.mcp.json` `{"mcpServers":{"existing":{"command":"node"}}}` + `CODEBUDDY.md`. `convert claude-code codebuddy --project --apply` → merged `.mcp.json` keeps `existing`, adds `search` (type stdio) + `api` (type http redacted); `CODEBUDDY.md` rewritten with project instructions; `.codebuddy/skills/review/SKILL.md`; backup.
- --replace-mcp (fresh seeded copy): only imported servers; `mcp:existing: removed by --replace-mcp`.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 31 files / 157 tests; record actual).
- `export codebudy -o /tmp/x53` → exit 2, list includes `codebuddy`, `did you mean "codebuddy"?`.
