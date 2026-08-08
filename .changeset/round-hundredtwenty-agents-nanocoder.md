---
"agentmove-cli": minor
---

Custom agents layer for Nanocoder: subagent markdown files in `~/.config/nanocoder/agents/` (project scope: `.nanocoder/agents/`; flat, `.md` only) now migrate as portable agents, copied byte-faithfully. Because nanocoder refuses to load an agent whose frontmatter lacks a non-empty `name` and `description`, imports inject the missing required keys with per-field warnings (a synthesized description reads `Imported by agentmove from agent <name>`). Nested agent names are flattened (`backend/sql` → `backend-sql`, warned; collisions after flattening skipped with a warning), and nanocoder-specific frontmatter (`provider`/`model`/`contextWindow`/`tools`/`disallowedTools`/`subscribe`) is copied as-is with a review warning. Skill-bundle agents (`skill.yaml` bundles) remain not migrated.
