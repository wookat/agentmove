# GAP ROUND-94: portable custom agents (subagents) layer

## Signal

Custom agent / subagent definitions have converged on the same shape across
major clients — a markdown file with YAML frontmatter — but live in
client-specific directories with client-specific extensions. Users moving
between clients currently have to copy these files by hand.

Official evidence:

- **GitHub Copilot CLI** — custom agents are `*.agent.md` files in
  `~/.copilot/agents/` (user) and `.github/agents/` (project):
  <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli>
- **Claude Code** — subagents are markdown files with YAML frontmatter in
  `~/.claude/agents/` (user) and `.claude/agents/` (project):
  <https://code.claude.com/docs/en/sub-agents>
- **Gemini CLI** — experimental subagents are markdown files in
  `~/.gemini/agents/` (user) and `.gemini/agents/` (project); enabled by
  default, `"experimental": {"enableAgents": false}` disables them:
  <https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md>

## Decision

Add an `agents` layer to the bundle model (`AgentDef { name, content }`,
stored as `agents/<name>.md`) and wire it into the three clients with
documented native support:

| Client | User scope | Project scope | Extension |
| --- | --- | --- | --- |
| claude-code | `~/.claude/agents/` | `.claude/agents/` | `.md` |
| copilot | `~/.copilot/agents/` | `.github/agents/` | `.agent.md` |
| gemini | `~/.gemini/agents/` | `.gemini/agents/` | `.md` |

Content is copied byte-for-byte, frontmatter included. Honest warnings:

- frontmatter fields such as `tools:` / `model:` are client-specific and
  copied as-is (review after import);
- gemini subagents are experimental (enabled by default, disable via the
  settings flag);
- clients with no agents directory skip the layer with a warning
  (central check in the CLI import path).

`--only agents` works like the other layers; `diff` and `doctor` report the
layer.

## Rejected alternatives

- **Normalizing frontmatter fields** (mapping `tools:` lists between
  clients): the tool vocabularies are disjoint and undocumented as a
  mapping; a wrong translation is worse than an honest copy + warning.
- **Xcode Claude / Xcode Gemini agents dirs**: no official documentation
  that the Xcode-bundled agents read an `agents/` directory — left out.
- **Treating agents as skills**: different discovery mechanism, different
  frontmatter contract, different invocation semantics — a separate layer
  keeps warnings honest.
