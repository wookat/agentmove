# GAP-ROUND-40 — Kiro adapter (18th client)

## Inputs this round

- Real npm data (api.npmjs.org, observed 2026-08-06): agentmove-cli daily
  downloads 08-04 = 131, 08-05 = 1607 — real adoption started; broad client
  coverage remains the top user-visible value.
- Repo signals: stars 1, forks 0, open issues 0 — no inbound bug reports.
- Competitor scan: hermes-agent still 0.19.0, no migration-tool movement.
- Ecosystem scan: Kiro (AWS's agentic IDE + CLI) has first-party docs for MCP,
  steering, and skills — and explicitly supports two open standards we already
  speak (AGENTS.md and Agent Skills SKILL.md), making it an unusually
  high-fidelity migration target.

## Official evidence (kiro.dev docs)

- MCP config: `~/.kiro/settings/mcp.json` (user) and `.kiro/settings/mcp.json`
  (workspace), root key `mcpServers`; stdio servers use `command`/`args`/`env`,
  remote servers use `url`/`headers`; native `disabled` boolean; extra
  client-specific keys `autoApprove`, `disabledTools`, `oauth`, `oauthScopes`.
  (kiro.dev/docs/mcp/configuration/)
- Steering: markdown files under `~/.kiro/steering/` (global) and
  `.kiro/steering/` (workspace); AGENTS.md standard files are picked up there;
  optional YAML front matter selects inclusion mode (always/fileMatch/manual).
  (kiro.dev/docs/steering/)
- Skills: open Agent Skills standard (SKILL.md) under `~/.kiro/skills/` and
  `.kiro/skills/`. (kiro.dev/docs/skills/)

## Gaps found → fixes

| # | Gap | Priority | Fix |
| --- | --- | --- | --- |
| 1 | No Kiro support despite first-party AGENTS.md + SKILL.md compatibility | P1 | New `kiro` adapter: mcp.json read/write (merge by default, native `disabled` round-trip), steering export/import, skills direct migration |
| 2 | Kiro-specific MCP keys would be silently dropped | P1 | `autoApprove`/`disabledTools`/`oauth`/`oauthScopes` reported as client-specific warnings |
| 3 | Steering multi-file structure has no bundle equivalent | P2 | Files merged into one instructions doc with `<!-- steering: file -->` markers + warning; import writes `.kiro/steering/AGENTS.md` (supported standard) |
| 4 | No durable memory store in Kiro | — | Honest warning on import; skipped |

## Implementation

- `packages/agentmove/src/adapters/kiro.ts` (+ registry/model/`project.ts`)
- Project scope: `.kiro/settings/mcp.json` + `.kiro/steering/` + `.kiro/skills/`
- Matrix e2e expanded to 18×18; round-trip targets to 18
- Fixtures use placeholder tokens only (`test-not-a-real-token`)
- Docs: README, website clients page + hero, man page, ROADMAP; minor changeset

## Verification

- build/lint/typecheck green; 109 unit/e2e tests green
- Testing-agent CLI e2e planned: doctor detection, dry-run redaction, merge
  import with native disabled flag, steering merge warning, project scope,
  typo exit 2 regression
