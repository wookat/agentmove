# Roadmap

Short-cycle, demand-driven. Order reflects current priority, not promises.

## Near term
- Project-scoped migration (`--project`): `.mcp.json`, `.cursor/rules/*.mdc`,
  project `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`
- Robustness: exit-code contract, `--debug`, graceful errors on corrupt configs
- `--json` output for doctor/diff (CI-friendly)

## Mid term
- More clients (Windsurf, Cline, Zed, OpenHands) — adapter contributions welcome
- MIF / PAM import & export for the memory layer
- npm provenance (OIDC trusted publishing)

## Long term
- Watch mode / continuous sync between two clients
- Bundle encryption for carrying agents across machines safely
