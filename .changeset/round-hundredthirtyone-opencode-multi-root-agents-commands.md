---
"agentmove-cli": minor
---

OpenCode custom agents and commands now merge every root opencode actually scans: `{agent,agents}/` and `{command,commands}/` in both `~/.config/opencode/` and the `~/.opencode/` fallback config dir (project: `.opencode/{agents,agent}/` + `.opencode/{commands,command}/`), read recursively with nested names preserved. Duplicate names keep the fallback-dir copy (matching opencode's last-config-dir-wins merge) with an explicit shadow warning; imports still write only the native plural roots.
