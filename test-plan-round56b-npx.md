# Test Plan — v0.30.0 npm release regression (kilo focus, clean env via npx)

Run everything from a repo-independent temp dir (`mktemp -d`), using `npx -y agentmove-cli@0.30.0` (NOT the local build). Fixture copies from `/home/ubuntu/repos/agentmove/packages/agentmove/test/fixtures/{kilo-home,openclaw-home}` into temp HOMEs. Registry check done: `npm view agentmove-cli@0.30.0 version` → 0.30.0, dist-tag latest.

## T1: version / clients / doctor
- `npx -y agentmove-cli@0.30.0 --version` → `0.30.0`.
- `npx -y agentmove-cli@0.30.0 clients` → list contains `kilo` (Kilo Code).
- `--home <kilo-home copy> doctor` → `✓ Kilo Code (kilo) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export kilo dry-run
- `--home <copy> export kilo -o <tmp bundle>` → exit 0; warnings redact `FS_API_KEY` + `Authorization`; bundle mcp-servers.json: filesystem stdio `command:"npx"` + `args:["-y","@modelcontextprotocol/server-filesystem","/tmp"]` + env `${FS_API_KEY}` (argv parsed, environment→env); api-server http `${Authorization}`; home copy `diff -r`-identical to fixture (no writes).

## T3: convert openclaw kilo --apply
- Temp home = openclaw-home fixture + kilo fixture files; run convert with --apply.
- Pass: merged `.config/kilo/kilo.json` keeps `theme:"dark"` + existing `filesystem`/`api-server` untouched; imported `docs` → `{"type":"local","command":["npx","-y","@modelcontextprotocol/server-fetch"]}`, `remote` → `{"type":"remote","url":...,"headers":{"Authorization":"${Authorization}"}}`; `.config/kilo/AGENTS.md` = instructions + `## Imported by agentmove: persona (SOUL.md)` with persona-approximated warning; `.kilo/skills/todo/SKILL.md` written (deploy-helper kept); `memory: kilo has no durable memory store; skipped (consider --mif)`; automatic backup created.

## T4: typo regression
- `npx -y agentmove-cli@0.30.0 export kil -o /tmp/x` → exit 2, list includes `kilo`, `did you mean "kilo"?`.
