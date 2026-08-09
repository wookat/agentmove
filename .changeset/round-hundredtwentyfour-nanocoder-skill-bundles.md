---
"agentmove-cli": minor
---

Nanocoder skill bundles: export now reads `~/.config/nanocoder/skills/<bundle>/` (project `.nanocoder/skills/`) — bundle `commands/*.md` export as `<bundle>/<name>` commands mirroring nanocoder's `/<bundle>:<name>` invocation, and the single `agents/*.md` subagent exports by file name (byte-faithful; flat-directory names win on collision). Bundle `tools/` (nanocoder shell tools) and `skill.yaml` extras (version/author/tags/subscribe/tools_visibility) are warned, not migrated; invalid manifests skip the bundle with a warning. Imports keep writing the flat directories, which round-trips bundle-command invocations without synthesizing bundles.
