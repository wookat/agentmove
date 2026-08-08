# GAP-ROUND-120: custom agents layer for Nanocoder

## Research

Nanocoder (Nano Collective) supports custom subagents as markdown files:

- User scope: `~/.config/nanocoder/agents/` on Linux
  (`~/Library/Preferences/nanocoder/agents/` on macOS,
  `%APPDATA%/nanocoder/agents/` on Windows — see below).
- Project scope: `.nanocoder/agents/` at the repository root.
- Discovery is **flat**: the loader reads `readdir` entries and only accepts
  top-level files ending in `.md`
  (`source/subagents/subagent-loader.ts` → `loadFromDirectory`).
- The frontmatter parser **requires** a non-empty string `name` and
  `description`; files missing either fail to load with an error
  (`source/subagents/markdown-parser.ts`).
- The markdown body after the frontmatter is the subagent's system prompt.
- Optional frontmatter: `provider`, `model`, `contextWindow`, `tools`,
  `disallowedTools`; skills may also add a `subscribe:` block. All are
  nanocoder-specific.
- Precedence: project > user > built-in, keyed by frontmatter `name`.

Evidence:

- Docs: https://github.com/Nano-Collective/nanocoder/blob/main/docs/features/subagents.md
- Loader: https://github.com/Nano-Collective/nanocoder/blob/main/source/subagents/subagent-loader.ts
- Parser: https://github.com/Nano-Collective/nanocoder/blob/main/source/subagents/markdown-parser.ts

## Decision

- Export user agents from `~/.config/nanocoder/agents/*.md` (flat) and
  project agents from `.nanocoder/agents/*.md`, byte-faithfully.
- Import writes flat files; nested agent names are flattened
  (`backend/sql` → `backend-sql`) with a warning, and collisions after
  flattening are skipped with a warning.
- Because nanocoder refuses to load agents without `name`/`description`
  frontmatter, imports inject the missing keys (warned per field); a
  synthesized description reads `Imported by agentmove from agent <name>`.
  Agents that already carry both keys are copied byte-faithfully.
- Nanocoder-specific frontmatter (`provider`/`model`/`contextWindow`/
  `tools`/`disallowedTools`/`subscribe`) is copied as-is with the usual
  review warning.

## Deferred (honest)

- The macOS (`~/Library/Preferences/nanocoder/agents/`) and Windows
  (`%APPDATA%/nanocoder/agents/`) user roots are not scanned — the existing
  nanocoder adapter (MCP + commands) already anchors on the XDG
  `~/.config/nanocoder/` root only, and this round keeps that convention
  for consistency. A future round could add per-platform root discovery
  across the whole adapter at once.
- Skill-bundle agents (`.nanocoder/skills/<name>/agents/`) are part of
  nanocoder's `skill.yaml` bundle format, which agentmove already documents
  as not migrated.
- Built-in agents (`explore`) are shipped with the client and are not
  user data; not exported.
