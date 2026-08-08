---
"agentmove-cli": minor
---

Commands layer for Crush (Charm): custom commands migrate from both user roots — `~/.config/crush/commands/` (XDG) and `~/.crush/commands/` — recursively with nested `:` namespaces preserved and the XDG root winning on name conflicts (warned). Imports write only the XDG root; project scope covers `.crush/commands/`. `$NAME` argument placeholders are client-specific and copied as-is with a warning.
