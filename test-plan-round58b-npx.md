# Test Plan — v0.32.0 npm release regression (grok focus, clean env via npx)

Run everything from a repo-independent temp dir (`mktemp -d`), using `npx -y agentmove-cli@0.32.0` (NOT the local build). Fixture copies from `/home/ubuntu/repos/agentmove/packages/agentmove/test/fixtures/{grok-home,openclaw-home}` into fresh temp HOMEs. Registry check done: `npm view agentmove-cli@0.32.0 version dist-tags` → 0.32.0, latest.

## T1: version / clients / doctor
- `npx -y agentmove-cli@0.32.0 --version` → `0.32.0`.
- `clients` → list contains `grok  Grok CLI  ~/.grok (config.toml + AGENTS.md + skills/)`.
- `--home <grok-home copy> doctor` → `✓ Grok CLI (grok) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: export grok (dual redaction, no writes)
- `--home <copy> export grok -o <tmp bundle>` → exit 0; warnings redact both `FS_API_KEY` and `Authorization`; bundle mcp-servers.json: filesystem stdio env `${FS_API_KEY}`; api-server transport http headers `${Authorization}`; home copy `diff -r`-identical to fixture (no writes).

## T3: grok→codex dry-run
- `convert grok codex` WITHOUT --apply → exit 0, prints `dry-run: would write ... file(s)`; home `diff -r`-identical afterwards (no writes).

## T4: convert openclaw grok --apply (merge)
- Temp home = grok fixture + openclaw fixture; run with --apply.
- Pass: merged `.grok/config.toml` keeps `[cli] theme = "dark"` and existing `[mcp_servers.filesystem]` (real env token) + `[mcp_servers.api-server]` untouched; imported `docs` = stdio table (command/args, no url/type field); `remote` = url table with `${Authorization}` header (no transport field); `.grok/AGENTS.md` = instructions + `## Imported by agentmove: persona (SOUL.md)` with `persona: grok has no persona file; appended to ~/.grok/AGENTS.md (approximated)`; `.grok/skills/todo/SKILL.md` written (deploy-helper kept); `memory: grok has no durable memory store; skipped (consider --mif)`; automatic backup under `.agentmove/backups/<ts>/`.

## T5: typo regression
- `npx -y agentmove-cli@0.32.0 export grokk -o /tmp/x` → exit 2, list includes `grok`, `did you mean "grok"?`.
