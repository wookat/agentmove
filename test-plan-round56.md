# Test Plan — PR #98 Round 56: Kilo Code adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (pnpm build first). Fixture copies in temp homes/projects.
Grounding: src/adapters/kilo.ts — user MCP under `mcp` key of `~/.config/kilo/kilo.json` (candidates kilo.json/kilo.jsonc/config.json L35, first existing rewritten in place L123-131; other config keys preserved since whole config reused); JSONC accepted with `kilo <file>: existing comments are not preserved on rewrite` warning (L48-50); entry shape local/remote: fromKiloEntry maps local→stdio, remote→http, command argv→command+args, environment→env (L57-72); toKiloEntry renders stdio→`type:"local"`+argv `command`+`environment`, remote→`type:"remote"`+url/headers, sse→remote with `kilo has no sse type; emitted as remote` warning (L83-85), cwd dropped warned (L90), `enabled:false` written natively (L91, NO disabled-flag warning); timeout warned client-specific on parse (L106-108); instructions `~/.config/kilo/AGENTS.md` + persona appended approximated (L159,178-186); memory `kilo has no durable memory store; skipped (consider --mif)` (L188-190); skills `~/.kilo/skills` (L160,191). project.ts:1311-1354 — kiloProject: candidates kilo.json/kilo.jsonc/.kilo/kilo.json(c), root AGENTS.md, `.kilo/skills`.
Fixture kilo-home: kilo.json `theme:"dark"`, mcp.filesystem local argv command + environment.FS_API_KEY, mcp.api-server remote + Authorization; AGENTS.md; skill deploy-helper.

## T1: doctor
- `--home <kilo-home copy> doctor` → `✓ Kilo Code (kilo) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export kilo
- Exit 0; redaction warnings for FS_API_KEY + Authorization; bundle mcp-servers.json: filesystem stdio with `command:"npx"` + `args:["-y","@modelcontextprotocol/server-filesystem","/tmp"]` (argv parsed) + env `${FS_API_KEY}`; api-server http `${Authorization}`; instructions.md = fixture AGENTS.md; skills/deploy-helper; home copy diff-identical (no writes).

## T3: convert openclaw kilo --apply (openclaw-home copy + kilo fixture files in same home)
- Exit 0; merged kilo.json keeps `theme:"dark"`; existing `filesystem`/`api-server` untouched; imported `docs` → `{"type":"local","command":["npx","-y","@modelcontextprotocol/server-fetch"]}`; `remote` → `{"type":"remote","url":...,"headers":{"Authorization":"${Authorization}"}}`.
- `.config/kilo/AGENTS.md` = openclaw instructions + `## Imported by agentmove: persona (SOUL.md)`; persona-approximated warning; skill `.kilo/skills/todo/SKILL.md` (deploy-helper kept); `memory: kilo has no durable memory store; skipped (consider --mif)`; backup created.

## T4: crafted bundle (cwd + enabled:false + sse)
- Bundle with `cwd-server` (stdio, cwd:/tmp/w), `off-server` (http, enabled:false), `legacy` (sse, url) imported into fresh kilo home copy.
- Pass: warnings `mcp:cwd-server: kilo does not support cwd; dropped` + `mcp:legacy: kilo has no sse type; emitted as remote`; NO disabled-flag warning; off-server written `{"type":"remote","url":...,"enabled":false}`; legacy written type remote; cwd-server has no cwd.

## T5: JSONC home
- Home with only `.config/kilo/kilo.jsonc` containing `// comment` + one server; import → warning `kilo kilo.jsonc: existing comments are not preserved on rewrite`; merged config written to kilo.jsonc (kilo.json NOT created); existing server kept.

## T6: project scope (two-dir export→import)
- `export claude-code --project <claude-project copy>` → bundle; target seeded with `.kilo/kilo.json` `{"instructions":"keep-me","mcp":{"existing":{"type":"local","command":["node"]}}}`; `import kilo --project <target> --apply`.
- Pass: merged `.kilo/kilo.json` keeps `instructions:"keep-me"` + `existing` untouched, adds `search` (type local argv) + `api` (type remote, `${Authorization}`); root `AGENTS.md` written with project instructions; `.kilo/skills/review/SKILL.md`; backup.
- --replace-mcp (fresh seeded copy): mcp = only imported; `mcp:existing: removed by --replace-mcp` warning.

## T7 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → all green (expect 34 files / 173 tests; record actual).
- `export kil -o /tmp/x56` → exit 2, list includes `kilo`, `did you mean "kilo"?`.
