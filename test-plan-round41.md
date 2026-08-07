# Test Plan — PR #70 Round 41: Roo Code adapter (shell-only)

CLI: `node /home/ubuntu/repos/agentmove/packages/agentmove/dist/cli.js` (rebuild `pnpm build` first). Fixtures copied to temp homes.
Grounding: src/adapters/roo.ts (parse streamable-http→http L70-72; render http→streamable-http L92; disabled↔enabled:false L76/L93; CLIENT_KEYS warnings L40,77-81; rules merged `<!-- rule: f.md -->` L109-113; persona→~/.roo/rules/agentmove.md L158-161; memory skipped L168-170); src/project.ts:746-781 (project .roo/mcp.json + .roo/rules/agentmove.md + .roo/skills). Fixture roo-home: local-tools stdio (API_KEY, alwaysAllow, disabled:false), modern-remote streamable-http (Authorization, disabled:true), legacy-remote sse, rules 01-general+02-style, skills/review, .roo/mcp.json (project-db).

## T1: doctor
- `--home <roo-home copy> doctor` → `✓ Roo Code (roo) — 3 MCP server(s), 1 skill(s), 0 memory entr(ies), instructions: yes`.

## T2: convert roo codex dry-run + bundle
- Exit 0; warnings: `local-tools.env.API_KEY` redaction, `modern-remote.headers.Authorization` redaction, `mcp:local-tools: roo alwaysAllow setting is client-specific; not migrated`, `instructions: roo global rules files merged into one document`; dry-run, nothing written.
- Export bundle: `modern-remote` transport `"http"` (streamable-http mapped) with `"enabled": false`; `legacy-remote` transport `"sse"`; instructions.md has `<!-- rule: 01-general.md -->` and `<!-- rule: 02-style.md -->` markers.

## T3: roo→codex --apply to temp home
- config.toml has `[mcp_servers.modern-remote]` with `enabled = false` and url.

## T4: openclaw→roo --apply (openclaw-home copy, pre-seed fixture mcp_settings.json at .config/... path)
- Exit 0; mcp_settings.json merge keeps `local-tools` (alwaysAllow intact), `modern-remote` (type streamable-http + disabled:true intact), `legacy-remote`; adds `docs` (stdio, no type) + `remote` with `"type": "streamable-http"` and redacted Authorization.
- `.roo/rules/agentmove.md` = instructions + persona section, warning `persona: roo has no persona file; appended to ~/.roo/rules/agentmove.md (approximated)`; skill `.roo/skills/todo/SKILL.md`; warning `memory: roo has no durable memory store; skipped`.

## T5: project-level convert claude-code roo --project <claude-project copy> --apply
- Writes `<proj>/.roo/mcp.json` (search stdio + api with type streamable-http, redacted), `<proj>/.roo/rules/agentmove.md`, `<proj>/.roo/skills/review/SKILL.md`.

## T6 (Regression): tests + typo
- `pnpm --filter agentmove-cli test` → 114/114 passed.
- `export rooo -o /tmp/x41` → exit 2, list includes `roo`, `did you mean "roo"?`.
