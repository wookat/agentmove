# GAP-ROUND-45 — website docs drift audit (introduction / limitations)

Round type: docs accuracy (user-data driven — same class of drift found in ROUND-36).

## Findings (real audit of the live docs vs shipped 0.20.0 behavior)

1. **P1 — `introduction.md` stale**: "Supported clients" still listed 14 clients
   ("… and goose — fourteen clients"). Shipped reality: 22 clients (Amp, Claude
   Desktop, VS Code, Kiro, Roo Code, Continue, Crush, Antigravity missing).
2. **P1 — `limitations.md` memory table stale AND inaccurate**:
   - Clients 15–22 absent from the table.
   - The old row claimed Cline/Zed/OpenHands/Copilot/OpenCode memory is
     "approximated into the instructions file". Verified against adapter source:
     only **Amp, Codex, Claude Code** approximate into instructions; the others
     **skip with a warning** (`memory: … skipped (consider --mif)`).
3. **P2 — skills section stale**: native `SKILL.md` list missed Amp, Kiro, Roo
   Code, Crush, Antigravity; the "skipped" list missed Copilot CLI, VS Code,
   Continue, Claude Desktop.
4. **P2 — disabled-flag list stale/inaccurate**: verified via
   `grep "no disabled flag" adapters/`: warning exists for claude-code, cursor,
   gemini, copilot, qwen, windsurf, **zed**, **openhands**, amp, vscode,
   continue, claude-desktop. Native flag keepers: cline, opencode, kiro, roo,
   crush, antigravity, goose. Old text wrongly implied Zed keeps the flag.

## Fixes (this round, website-only, no package change → no changeset)

- `introduction.md`: 22-client list.
- `limitations.md`: memory table rewritten to match actual adapter warnings
  (Amp approximates; 12 clients skip with `--mif` hint); skills and
  disabled-flag lists corrected per source-of-truth grep above.

## Evidence

- Adapter warnings: `packages/agentmove/src/adapters/*.ts` (`memory:`/`skills:`
  and `no disabled flag` warnings — greps recorded in this round's session).
- npm downloads (real, api.npmjs.org 2026-08-01..07): 0,0,0,131,1607,0,0 —
  new-user influx makes docs accuracy the highest-value fix.

## Follow-up / process gap

Client-facts appear in 3 hand-maintained places (clients.md, limitations.md,
introduction.md). Consider generating these lists from adapter metadata in a
future round to prevent recurring drift (ROUND-36 fixed the same class).
