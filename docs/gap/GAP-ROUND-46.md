# GAP-ROUND-46 — docs-drift guard (process fix from ROUND-45 follow-up)

Round type: process/quality — stop the recurring "client lists drift" class of
bug (already fixed twice: ROUND-36 and ROUND-45).

## Findings

1. **P1 — README intro stale**: the very first paragraph of README.md still
   said "between OpenClaw, Hermes Agent, Claude Code, Codex CLI, Cursor, and
   Gemini CLI" (six clients, from v0.1 era). Shipped reality: 22 clients.
   This is the first thing every npm/GitHub visitor reads.
2. **Process gap** (from GAP-ROUND-45): client facts are hand-maintained in
   README.md, website introduction.md, and website clients.md with no guard.

## Fixes

- README intro updated to "twenty-two clients … (see the full table below)".
- New `packages/agentmove/test/docs-sync.test.ts` (3 tests, CI-enforced):
  - introduction.md must mention every adapter label AND the correct count
    word ("twenty-two clients") — adding client #23 without updating the
    intro now fails CI.
  - clients.md must mention every adapter label.
  - README.md must mention every adapter label.
  - `ALIASES` allows documented short forms ("Codex CLI" for
    "OpenAI Codex CLI").

The guard immediately caught the stale README intro (test failed before the
README fix, passed after) — proof it works.

## Also this round (release ops)

- v0.20.0 GitHub Release created:
  https://github.com/wookat/agentmove/releases/tag/v0.20.0
- Clean-env regression of `npx agentmove-cli@0.20.0` focused on antigravity:
  doctor detection (2 MCP + 1 skill, disabledTools + GEMINI.md warnings),
  dry-run redaction (API_KEY + Authorization → ${VAR}), openclaw→antigravity
  --apply merge (existing entries + client-specific keys preserved, imported
  remote written with `serverUrl`, backup created), typo `antigravty` exit 2
  with did-you-mean. All passed.

## Verification

- 24 test files / 129 tests green; lint + typecheck green.
