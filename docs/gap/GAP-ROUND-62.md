# GAP-ROUND-62: Antigravity 2.0 ecosystem update (Gemini CLI retirement)

## Ecosystem event

- Google retired the consumer tiers of **Gemini CLI** on 2026-06-18
  (developers.googleblog.com "Transitioning Gemini CLI to Antigravity CLI";
  google-gemini/gemini-cli discussion #27274). Enterprise/paid-API access
  continues, so the `gemini` adapter stays.
- The replacement is the **Antigravity CLI** (`agy`,
  github.com/google-antigravity/antigravity-cli — docs-only repo, closed
  source Go binary). It shares one agent harness and one config surface with
  Antigravity 2.0 desktop and the Antigravity IDE.

## Verified facts

- All three Antigravity surfaces read the shared global MCP config at
  `~/.gemini/config/mcp_config.json` and global skills at
  `~/.gemini/config/skills/`, with workspace overrides in
  `.agents/mcp_config.json` / `.agents/skills/` (atamel.dev 2026-07-10
  write-up; antigravity.google docs). **This is exactly what AgentMove's
  `antigravity` adapter already reads and writes** (round 44), so the
  Antigravity CLI is already covered — no new adapter needed.
- Per-surface directories (`~/.gemini/antigravity-cli/`, `.../antigravity/`,
  `.../antigravity-ide/`) hold only caches and built-in skills, not user
  config — correctly out of scope.

## This round

- Docs-only: clients table and lossy-edges notes now state that the
  `antigravity` adapter covers the desktop app, the IDE, and the Antigravity
  CLI (`agy`), and point `gemini → antigravity` migration at the retirement.

## Deferred / rejected candidates

- **Pi (earendil-works/pi)**: MCP support is provided by third-party
  extensions (`pi-mcp-adapter`, `pi-mcp`), not the core agent; config
  locations vary by extension. Revisit if MCP lands natively.
- **mcp-synchro / mcp-doctor / mcp-sync**: competitor scan only — all
  MCP-layer sync/diagnostic tools; none migrate skills/memory/persona.
