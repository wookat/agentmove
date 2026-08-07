# Test Plan — v0.33.0 npm release regression (vibe focus, clean env via npx)

Run everything from a repo-independent temp dir (`mktemp -d`), using `npx -y agentmove-cli@0.33.0` (NOT the local build). Fixture copies from `/home/ubuntu/repos/agentmove/packages/agentmove/test/fixtures/{vibe-home,openclaw-home}` into fresh temp HOMEs. Registry check done: `npm view agentmove-cli@0.33.0 version dist-tags` → 0.33.0, latest.

## T1: version / clients / doctor
- `npx -y agentmove-cli@0.33.0 --version` → `0.33.0`.
- `clients` → list contains `vibe  Vibe Code CLI  ~/.vibe (config.toml + AGENTS.md + skills/)`.
- `--home <vibe-home copy> doctor` → `✓ Vibe Code CLI (vibe) — 2 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes` + `! mcp:filesystem: vibe startup_timeout_sec setting is client-specific; not migrated`.

## T2: export vibe (dual redaction, no writes)
- `--home <copy> export vibe -o <tmp bundle>` → exit 0; warnings redact both `FS_API_KEY` and `Authorization`; bundle mcp-servers.json: filesystem stdio env `${FS_API_KEY}`; api-server transport http headers `${Authorization}`; home copy `diff -r`-identical to fixture (no writes).

## T3: vibe→codex dry-run
- `convert vibe codex` WITHOUT --apply → exit 0, prints `dry-run: would write ... file(s)`; home `diff -r`-identical afterwards (no writes).

## T4: convert openclaw vibe --apply (merge)
- Temp home = vibe fixture + openclaw fixture; run with --apply.
- Pass: merged `.vibe/config.toml` keeps `active_model = "devstral-medium"`; existing `filesystem` entry intact incl. `startup_timeout_sec = 30` + real env token; `api-server` untouched; imported `docs` = `[[mcp_servers]]` entry with `transport = "stdio"` + command/args, NO url/cwd keys; imported `remote` = `transport = "http"` + url + `${Authorization}` headers; `.vibe/AGENTS.md` contains `## Imported by agentmove: persona (SOUL.md)` with `persona: vibe has no persona file; appended to ~/.vibe/AGENTS.md (approximated)`; `.vibe/skills/todo/SKILL.md` written (deploy-helper kept); `memory: vibe has no durable memory store; skipped (consider --mif)`; automatic backup under `.agentmove/backups/<ts>/`.

## T5: typo regression
- `npx -y agentmove-cli@0.33.0 export vibee -o /tmp/x` → exit 2, list includes `vibe`, `did you mean "vibe"?`.
