---
"agentmove-cli": minor
---

Vibe Code CLI custom agents: export reads `~/.vibe/agents/*.toml` profiles (project `.vibe/agents/`) — `description` maps to frontmatter and a `system_prompt_id` that resolves to a custom `~/.vibe/prompts/` markdown file exports as the agent body; vibe-specific overrides (display_name, safety, agent_type, tools/permissions/model, …) are dropped with per-field warnings. Imports write a description profile TOML plus a `~/.vibe/prompts/<name>.md` prompt wired up via `system_prompt_id` when the agent has a body; nested names are flattened and profiles named after vibe builtin agents warn that they override them.
