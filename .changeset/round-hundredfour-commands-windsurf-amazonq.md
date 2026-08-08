---
"agentmove-cli": minor
---

Commands layer for Windsurf and Amazon Q Developer CLI: migrate markdown slash commands to/from Windsurf workflows (`~/.codeium/windsurf/global_workflows/`; project `.windsurf/workflows/`) and Amazon Q saved prompts (`~/.aws/amazonq/prompts/`; project `.amazonq/prompts/`). Both are flat-scan clients — nested command names are flattened with a warning; Windsurf commands over the 12000-character workflow limit are written as-is with a warning.
