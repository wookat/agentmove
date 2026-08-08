---
"agentmove-cli": minor
---

Commands layer for Kiro: saved prompts in `~/.kiro/prompts/*.md` (flat, invoked as `@name` in kiro-cli) now export as portable commands byte-faithfully, and imported commands are written back as prompt files (nested names flattened with a warning; no-argument and workspace-override semantics warned honestly). Project scope covers `.kiro/prompts/`.
