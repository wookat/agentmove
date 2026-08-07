# Test Plan — PR #94 Round 54: Qoder CLI (Alibaba) adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixture copies in temp homes/projects.
Grounding: src/adapters/qoder.ts — user MCP under `mcpServers` key of `~/.qoder/settings.json`, other settings keys preserved on rewrite (L34,89-94: config read whole, only mcpServers replaced); ws-type servers skipped on export with warning (L52-55); isProxy warned client-specific (L58-60); no disabled flag → `qoder has no disabled flag; imported as enabled` (L72-74); cwd dropped warned (L75); imports render explicit type (renderCommonMcpEntry(...,true) L76); instructions `~/.qoder/AGENTS.md` + persona approximated (L116,140-148); `~/.qoder/rules` dir → client-specific warning (L117-121); memory app-managed warning (L150-152); skills `~/.qoder/skills` (L122,153). project.ts:1219-1263 — qoderProject: `.mcp.json` merge, AGENTS.md (AGENTS.local.md read fallback L1226-1228), `.qoder/skills`, `.qoder/rules` warned.
Fixture qoder-home settings.json: `theme:"dark"`, filesystem stdio (no type, FS_API_KEY) + api-server http (Authorization), `mcp:{allowed:["filesystem"]}`; AGENTS.md; skill deploy-helper.

## T1: doctor
- `--home <qoder-home copy> doctor` → `✓ Qoder CLI (qoder) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export qoder
- Exit 0; redaction warnings for `FS_API_KEY` + `Authorization`; bundle mcp-servers.json has `${FS_API_KEY}`/`${Authorization}`; instructions.md = fixture AGENTS.md; skills/deploy-helper in bundle; home copy diff-identical (no writes).

## T3: convert openclaw qoder --apply (openclaw-home copy + qoder fixture .qoder in same home)
- Exit 0; merged settings.json keeps `theme:"dark"` and `mcp.allowed:["filesystem"]` top-level keys; existing `filesystem` (no type, real key) + `api-server` untouched; imported `docs` explicit `"type":"stdio"` + `remote` explicit `"type":"http"` (redacted Authorization).
- `.qoder/AGENTS.md` = openclaw instructions + `## Imported by agentmove: persona (SOUL.md)`; persona-approximated warning; skill `.qoder/skills/todo/SKILL.md` (deploy-helper kept); `memory: qoder auto-memory is app-managed; skipped (consider --mif)`; backup created.

## T4: crafted bundle (cwd + enabled:false)
- Export qoder fixture bundle, overwrite mcp-servers.json with `cwd-server` (stdio, cwd:/tmp/w) + `off-server` (http, enabled:false); import into fresh qoder home copy.
- Pass: warnings `mcp:cwd-server: qoder does not support cwd; dropped` and `mcp:off-server: qoder has no disabled flag; imported as enabled`; written entries: cwd-server without cwd, off-server as plain enabled entry (no disabled/enabled key).

## T5: ws + isProxy export
- Fresh home with settings.json containing `ws-server` (`type:"ws"`, url) and `proxy-server` (stdio + `isProxy:true`); export qoder.
- Pass: warnings `mcp:ws-server: qoder ws (WebSocket) transport has no portable equivalent; skipped` and `mcp:proxy-server: qoder isProxy is client-specific; not migrated`; bundle contains only proxy-server (no ws-server, no isProxy key).

## T6: project scope (two-dir export→import; both clients use .mcp.json/AGENTS.md)
- `export claude-code --project <claude-project copy>` → bundle; target dir seeded with `.mcp.json` `{"mcpServers":{"existing":{"command":"node"}}}` + `AGENTS.md` ("# Old"); `import qoder --project <target> --apply`.
- Pass: merged `.mcp.json` keeps `existing` untouched, adds `search` (type stdio) + `api` (type http, `${Authorization}`); `AGENTS.md` rewritten with project instructions; `.qoder/skills/review/SKILL.md`; backup of seeded files.
- --replace-mcp (fresh seeded copy): mcpServers = only imported; `mcp:existing: removed by --replace-mcp` warning.

## T7 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 32 files / 162 tests; record actual).
- `export qodr -o /tmp/x54` → exit 2, list includes `qoder`, `did you mean "qoder"?`.
