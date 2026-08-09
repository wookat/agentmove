# GAP-ROUND-131: OpenCode multi-root custom agents and commands

## Gap

AgentMove read OpenCode custom agents only from `~/.config/opencode/agents/`
(plus the legacy singular `agent/`, non-recursively) and custom commands only
from `~/.config/opencode/commands/`. Upstream OpenCode discovers both layers
in **every config directory** and **recursively**.

## Upstream evidence (sst/opencode, checkout at /tmp/ocq)

- `packages/opencode/src/config/agent.ts`: agents are loaded with
  `Glob.scan("{agent,agents}/**/*.md", { cwd: dir, ... })` — both the
  singular and plural directory, recursively; the entry name is the relative
  path with the `agent/`/`agents/` prefix stripped (nested paths become part
  of the name).
- `packages/opencode/src/config/command.ts`: commands are loaded with
  `Glob.scan("{command,commands}/**/*.md", ...)` with the same naming rule.
- `packages/opencode/src/config/config.ts` (~line 459): for each config dir,
  `result.command = mergeDeep(result.command ?? {}, ConfigCommand.load(dir))`
  and the same for agents — **the last-loaded dir wins per name**.
- `packages/opencode/src/config/paths.ts`: config dirs are ordered
  `[Global.Path.config (~/.config/opencode), project .opencode dirs walking
  up, ~/.opencode (home fallback)]` — so the `~/.opencode` fallback dir
  overrides `~/.config/opencode` on duplicate names.

## Implementation

- `readOpencodeEntries(base, roots, layer, warnings)` in
  `src/adapters/opencode.ts` merges roots in priority order with
  first-root-wins and a per-duplicate shadow warning; results sorted by name.
- User export roots (highest priority first, mirroring upstream
  last-dir-wins with a deterministic plural-over-singular tiebreak within a
  dir, where upstream's glob order is unspecified):
  - agents: `.opencode/agents` > `.opencode/agent` >
    `.config/opencode/agents` > `.config/opencode/agent`
  - commands: `.opencode/commands` > `.opencode/command` >
    `.config/opencode/commands` > `.config/opencode/command`
- Agents are now read **recursively** (nested names preserved), matching the
  upstream `**/*.md` pattern; previously only flat files were exported.
- Project export reads `.opencode/{agents,agent}/` and
  `.opencode/{commands,command}/` with the same semantics.
- Imports are unchanged: only the native plural roots are written
  (`~/.config/opencode/agents/` + `commands/`, project `.opencode/agents/` +
  `commands/`) to avoid taking ownership of the fallback dir.

## Deferred (documented, not migrated)

- `{mode,modes}/*.md` primary-mode definitions (loadMode) — a distinct
  OpenCode concept layered on agents; not part of the portable agents layer.
- `OPENCODE_CONFIG_DIR` / `OPENCODE_CONFIG_CONTENT` overrides.
- Plugin-provided agents/commands.
