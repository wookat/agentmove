# GAP ROUND-95 — Custom agents layer for OpenCode and Qwen Code

## Finding

ROUND-94 introduced the portable custom agents (subagents) layer for Claude
Code, GitHub Copilot CLI, and Gemini CLI. Two more supported clients have an
officially documented markdown-agents mechanism and were still skipping the
layer with a warning:

- **OpenCode** — markdown agents in `~/.config/opencode/agents/` (global) and
  `.opencode/agents/` (project). The loader also scans the legacy singular
  `agent/` directory: `Glob.scan("{agent,agents}/**/*.md", ...)`.
  - Docs: <https://opencode.ai/docs/agents/> ("You can also define agents
    using markdown files. Place them in: Global: `~/.config/opencode/agents/`,
    Per-project: `.opencode/agents/`. The markdown file name becomes the
    agent name.")
  - Source: `packages/opencode/src/config/agent.ts` in
    <https://github.com/sst/opencode>.
- **Qwen Code** — subagents stored as markdown with YAML frontmatter in
  `.qwen/agents/` (project, highest precedence) and `~/.qwen/agents/` (user).
  Qwen explicitly documents Claude Code frontmatter compatibility ("you can
  drop a CC agent file into `.qwen/agents/` and have the supported fields
  parse identically").
  - Docs: `docs/users/features/sub-agents.md` in
    <https://github.com/QwenLM/qwen-code>.

## Decision

Extend the existing `agents` layer to both clients, reusing the byte-faithful
`readAgentsDir`/`planAgents` helpers with the `.md` extension:

| Client | User scope | Project scope |
|---|---|---|
| OpenCode | `~/.config/opencode/agents/` (legacy `agent/` also read) | `.opencode/agents/` (legacy `.opencode/agent/` also read) |
| Qwen Code | `~/.qwen/agents/` | `.qwen/agents/` |

Writes always target the canonical plural `agents/` directory. On export the
plural directory wins when the same agent name exists in both spellings.

Honest warnings on import:

- OpenCode: `mode`/`model`/`permission` frontmatter fields are
  client-specific and copied as-is.
- Qwen Code: `tools`/`model`/`approvalMode` frontmatter fields are
  client-specific and copied as-is.

## Rejected alternatives

- **Normalizing frontmatter between clients** — same reasoning as ROUND-94:
  field vocabularies differ (`mode` vs `approvalMode`, permission maps vs
  tool lists) and any mapping would be lossy and surprising. Byte-faithful
  copy plus an honest warning is safer.
- **Writing OpenCode agents to the legacy `agent/` directory** — the current
  docs use the plural `agents/`; legacy is read-only for compatibility.
- **Scanning OpenCode's nested `agents/**/*.md`** — the portable model keys
  agents by flat name; nested agent files are a rarity and can be added later
  if evidence of real-world use appears.
