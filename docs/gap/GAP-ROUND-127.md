# GAP-ROUND-127: Vibe Code CLI custom agents (TOML profiles + prompts)

## Gap

AgentMove's `vibe` adapter covered MCP servers (`~/.vibe/config.toml`),
instructions (`~/.vibe/AGENTS.md`), and Agent Skills (`~/.vibe/skills/`),
but not Vibe's custom agents layer, even though the custom agents bundle
layer already round-trips for Claude Code, Copilot, Gemini, OpenCode,
Qwen, Cursor, Kiro, Droid, CodeBuddy, Qoder, Kimi, Kilo, Amazon Q, Roo,
Nanocoder, Auggie, and Codex.

## Upstream evidence (mistralai/mistral-vibe source)

- `vibe/core/config/harness_files/_paths.py`:
  `GLOBAL_AGENTS_DIR = VIBE_HOME / "agents"`,
  `GLOBAL_PROMPTS_DIR = VIBE_HOME / "prompts"` (VIBE_HOME = `~/.vibe`).
- Project discovery (`find_local_config_dirs`) registers `.vibe/agents`
  (and `.vibe/tools`, `.vibe/skills`, `.agents/skills`).
- `vibe/core/agents/manager.py` `_discover_agents()`: globs `*.toml`
  (flat, non-recursive) in `config.agent_paths` → project agents dirs →
  user agents dirs; first-found name wins; a custom agent may override a
  builtin of the same name (logged).
- `vibe/core/agents/models.py` `AgentProfile.from_toml()`:
  `name = path.stem`; pops `display_name`, `description`, `safety`,
  `agent_type`; **everything else is `overrides`** — a config overlay
  merged into `VibeConfigSchema` (tools, permissions, model,
  `system_prompt_id`, …). Builtin EXPLORE/LEAN agents use
  `overrides["system_prompt_id"]`.
- `vibe/core/prompts/__init__.py` `load_prompt()`: `system_prompt_id`
  resolves first against custom prompt dirs (`project_prompts_dirs` +
  `user_prompts_dirs`, i.e. `.vibe/prompts/` and `~/.vibe/prompts/`),
  then builtins (`cli`, `explore`, `tests`, `lean`, `minimal`). Prompt
  ids must be bare filenames (no path separators; validated).
- Builtin agents (`BUILTIN_AGENTS`): `default`, `plan`, `accept-edits`,
  `auto-approve`, `explore`, `lean`.

## Design

Export (`~/.vibe/agents/*.toml`, project `.vibe/agents/`; flat glob,
name = file stem, matching the upstream loader):

- `description` → portable frontmatter description.
- If `system_prompt_id` resolves to a custom prompt markdown file under
  the sibling prompts dir → that prompt is the agent body; builtin or
  missing ids warn and export no body.
- `display_name`, `safety`, non-`agent` `agent_type`, and every other
  config override → per-field "no portable equivalent; dropped" warning.
- Invalid TOML / non-table files → warned, not migrated. Profiles with
  neither description nor custom prompt → warned, not migrated.

Import:

- Writes `description` profile TOML to the agents dir; when the agent
  has a body, also writes `<promptsDir>/<name>.md` and wires it via
  `system_prompt_id = "<name>"` — the vibe-idiomatic way to give an
  agent a prompt (same mechanism as builtin explore/lean).
- Nested names flattened (`team/planner` → `team-planner`, warned; vibe
  requires bare filenames). Collisions after flattening skipped, warned.
- A name matching a vibe builtin agent warns that it overrides it.
- Frontmatter beyond `description` kept verbatim in the prompt file,
  warned (codex precedent).

## Deferred (documented in limitations)

- Extra `agent_paths` directories configured in `config.toml`.
- `~/.vibe/tools/` custom tools and `skills-registry-cache/`.

## Tests

`test/vibe.test.ts`: export (custom-prompt body, per-field drop
warnings, builtin prompt id warning, invalid TOML skip), import
(profile+prompt wiring, nested flatten, builtin override warning,
body-less profile writes no prompt), project-scope round-trip.
