---
"agentmove-cli": minor
---

Commands layer for Antigravity: workflows in `~/.gemini/config/global_workflows/*.md` (flat, triggered as `/name` in AGY and AGY IDE) now export as portable commands byte-faithfully, and imported commands are written back as workflow files (nested names flattened with a warning; the AGY CLI's list-only limitation is warned honestly). Project scope covers `.agents/workflows/`.
