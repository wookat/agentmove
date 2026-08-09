# GAP-ROUND-133: OpenCode inline `agent`/`command`/`mode` entries in opencode.json(c)

## Gap

OpenCode lets users define custom agents, commands and primary modes **inline**
in `opencode.json` / `opencode.jsonc` (under the `agent`, `command` and `mode`
keys), not just as markdown files. AgentMove previously exported only the
markdown roots, so inline definitions were silently dropped on migration.

## Upstream evidence (sst/opencode, /tmp/ocq)

`packages/opencode/src/config/config.ts`:

- `loadGlobal` merges `~/.config/opencode/config.json`, then `opencode.json`,
  then `opencode.jsonc` (later wins).
- The config-dir loop (`ConfigPaths.directories`: global config dir, project
  `.opencode` dirs, `~/.opencode`) loads `opencode.json` then `opencode.jsonc`
  for every dir ending in `.opencode`, then merges markdown
  `ConfigCommand.load`, `ConfigAgent.load`, `ConfigAgent.loadMode` on top:

  ```ts
  result.command = mergeDeep(result.command ?? {}, yield* Effect.promise(() => ConfigCommand.load(dir)))
  result.agent = mergeDeep(result.agent ?? {}, yield* Effect.promise(() => ConfigAgent.load(dir)))
  result.agent = mergeDeep(result.agent ?? {}, yield* Effect.promise(() => ConfigAgent.loadMode(dir)))
  ```

- After all sources merge, the inline `mode` map merges **last** into the agent
  map and always wins, with `mode: "primary"`:

  ```ts
  for (const [name, mode] of Object.entries(result.mode ?? {})) {
    result.agent = mergeDeep(result.agent ?? {}, { [name]: { ...mode, mode: "primary" as const } })
  }
  ```

- `packages/core/src/v1/config/agent.ts` (`ConfigAgentV1.Info`): inline agents
  take `prompt`, `description`, `model`, `temperature`, `mode`, `permission`,
  `disable`, etc.
- `packages/core/src/v1/config/command.ts` (`ConfigCommandV1.Info`): inline
  commands require a string `template`; optional `description`/`agent`/
  `model`/`variant`/`subtask`.
- `packages/opencode/src/config/variable.ts`: `{env:VAR}` and `{file:path}`
  placeholders are substituted at config load time relative to the config file.

## Resulting precedence (last-merge-wins, expressed as first-wins roots)

User scope (agents layer):
inline `mode` (`.opencode/opencode.jsonc` > `.json` > `.config/opencode/opencode.jsonc` > `.json`)
> `.opencode/{modes,mode}` md > `.opencode/{agents,agent}` md
> `.opencode` inline `agent` (jsonc > json)
> `.config/opencode/{modes,mode}` md > `.config/opencode/{agents,agent}` md
> `.config/opencode` inline `agent` (jsonc > json).

Commands: `.opencode` md > `.opencode` inline > `.config` md > `.config` inline.

Project scope: same shape with the project `.opencode/opencode.json(c)` dir
config beating the project-root `opencode.json(c)` files.

## AgentMove behavior

- Inline entries are exported as synthesized markdown: YAML frontmatter from
  the remaining fields, body from `prompt`/`template`, with a per-entry
  warning naming the source file and key.
- `disable: true` entries and inline commands without a string `template` are
  skipped with warnings; `{file:...}`/`{env:...}` placeholders are copied
  as-is with a warning.
- Imports are unchanged: only the native markdown roots are written; inline
  config entries are never synthesized.

## Deferred (honest limitations)

- opencode deep-merges overlapping definitions of the same name field-by-field
  across sources; AgentMove picks a whole-entry winner and warns.
- `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT` and
  plugin-contributed entries remain out of scope (see GAP-ROUND-131/132).
