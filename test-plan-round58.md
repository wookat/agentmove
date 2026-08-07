# Test Plan — PR #102 Round 58: Grok CLI adapter (shell-only)

CLI: `node packages/agentmove/dist/cli.js` after `pnpm build`. Fixture copies in mktemp homes/projects; never real data.
Grounding: src/adapters/grok.ts — `~/.grok/config.toml` `[mcp_servers.*]` TOML (L33,48); stdio command/args/env, remote url/headers, no transport field (L64-72,77-90); timeout warning `grok timeout settings are client-specific; not migrated` (L61-63); cwd drop `grok does not document cwd; dropped` (L83); sse `grok has no documented sse transport; emitted as url` (L85-87); enabled:false `grok config.toml has no documented disabled flag; imported as enabled (use \`grok mcp disable\`)` (L91-95); other tables preserved (config spread, L107-115); AGENTS.md persona approximation (L156-164); memory skip (L166-168); skills `.grok/skills` (L169). project.ts:1397-1434 — `.grok/config.toml`, root AGENTS.md, `.grok/skills`.
Fixture grok-home: `[cli] theme="dark"`; filesystem stdio (FS_API_KEY env) + api-server url (Authorization header); AGENTS.md; skill deploy-helper.

## T1: clients + doctor
- `clients` lists `grok  Grok CLI  ~/.grok (config.toml + AGENTS.md + skills/)`.
- `--home <grok-home copy> doctor` → `✓ Grok CLI (grok) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export grok (dual redaction, no writes)
- Exit 0; warnings redact FS_API_KEY + Authorization; bundle mcp-servers.json: filesystem stdio env `${FS_API_KEY}`, api-server http `${Authorization}`; instructions.md = fixture AGENTS.md; skills/deploy-helper; home copy `diff -r`-identical (no writes).

## T3: grok→codex dry-run
- `convert grok codex` no --apply → exit 0, `dry-run: would write ... file(s)` only; home `diff -r`-identical.

## T4: openclaw→grok --apply merge
- Temp home = grok fixture + openclaw fixture; `convert openclaw grok --apply`.
- Pass: merged `.grok/config.toml` keeps `[cli] theme = "dark"`; existing `filesystem` (real key) + `api-server` untouched; imported `docs` stdio table (command/args, no url/type), `remote` url table with redacted `${Authorization}` header (no transport field); `.grok/AGENTS.md` = instructions + `## Imported by agentmove: persona (SOUL.md)` + warning; `.grok/skills/todo/SKILL.md` (deploy-helper kept); `memory: grok has no durable memory store; skipped (consider --mif)`; automatic backup.

## T5: crafted bundle — cwd / sse / enabled:false warnings
- Import bundle with `cwd-server` (stdio cwd), `legacy` (sse url), `off-server` (http enabled:false) into fresh grok home.
- Pass warnings: `grok does not document cwd; dropped` (entry written WITHOUT cwd); `grok has no documented sse transport; emitted as url` (written as url table); `grok config.toml has no documented disabled flag; imported as enabled (use \`grok mcp disable\`)` (entry written without disabled flag).
- Supplement: home with `startup_timeout_sec` on a server → export warns `grok timeout settings are client-specific; not migrated`.

## T6: --replace-mcp
- Fresh grok+openclaw home, `--apply --replace-mcp` → only `docs,remote` in `[mcp_servers]`; warnings `mcp:filesystem: removed by --replace-mcp` + `mcp:api-server: removed by --replace-mcp`; `[cli]` still preserved.

## T7: typo
- `export grokk -o /tmp/x58` → exit 2, list includes `grok`, `did you mean "grok"?`.

## T8: project scope (two-dir export→import; claude-code and grok share root AGENTS.md)
- Target seeded with `.grok/config.toml` containing `[mcp_servers.existing]` (command="node") + an unrelated `[cli]` key + root `AGENTS.md`.
- `export claude-code --project <claude-project copy>` → `import grok --project <target> --apply`: keeps `existing` + `[cli]`, adds `search` (stdio) + `api` (url, `${Authorization}`); root AGENTS.md rewritten; `.grok/skills/review/SKILL.md`; backup. `--replace-mcp` fresh copy → only imported + removal warning.
- Also project export: `export grok --project <seeded dir>` parses `[mcp_servers.*]`.

## T9 (Regression): full suite
- `pnpm --filter agentmove-cli test` → all green (expect 36 files / 183 tests; record actual).
