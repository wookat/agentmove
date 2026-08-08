---
"agentmove-cli": minor
---

Commands layer for Cortex Code (Snowflake CoCo): custom commands migrate from `~/.snowflake/cortex/commands/` recursively with nested names preserved and content copied byte-faithfully; frontmatter and argument conventions from other clients are copied as-is with a warning. No project-scoped commands directory is documented (project commands ship only inside plugins), so project-scope imports skip commands with a warning.
