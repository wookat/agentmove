# GAP-ROUND-132: OpenCode primary modes ({mode,modes}/*.md) missing from the agents layer

## Gap

OpenCode loads **primary modes** — top-level markdown files under `mode/` or
`modes/` in every config directory — into the same agent map as custom
agents, forcing `mode: "primary"`. AgentMove (through 0.100.0) only read
`{agent,agents}/`, so mode definitions were silently dropped on export.

## Upstream evidence (sst/opencode)

`packages/opencode/src/config/agent.ts`:

```ts
export async function loadMode(dir: string) {
  const result: Record<string, ConfigAgentV1.Info> = {}
  for (const item of await Glob.scan("{mode,modes}/*.md", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    ...
    result[config.name] = {
      ...parsed.value,
      mode: "primary" as const,
    }
  }
  return result
}
```

Key facts:

- The glob is `{mode,modes}/*.md` — **flat**, unlike the recursive
  `{agent,agents}/**/*.md`. Nested mode files are never loaded.
- `packages/opencode/src/config/config.ts` merges per config dir:

  ```ts
  result.agent = mergeDeep(result.agent ?? {}, ConfigAgent.load(dir))
  result.agent = mergeDeep(result.agent ?? {}, ConfigAgent.loadMode(dir))
  ```

  `loadMode` merges **after** `load`, so within one config dir a mode beats a
  same-name agent. Across dirs, the later config dir (the `~/.opencode`
  fallback) still wins, same as ROUND-131.
- Names come from `configEntryNameFromPath(rel, ["mode/", "modes/"])` —
  basename without extension.

## AgentMove behavior (this round)

User agent-layer roots, first-wins order:

```
.opencode/modes        (flat, primary mode)
.opencode/mode         (flat, primary mode)
.opencode/agents       (recursive)
.opencode/agent        (recursive)
.config/opencode/modes (flat, primary mode)
.config/opencode/mode  (flat, primary mode)
.config/opencode/agents
.config/opencode/agent
```

Project scope prepends `.opencode/{modes,mode}` (flat) to the project agent
roots the same way.

- Mode files are exported byte-faithfully into the agents layer; each winning
  mode entry emits
  `agents:<name>: <root> entry is an opencode primary mode (loaded with mode: "primary"); exported as a regular agent`.
- Duplicate names reuse the existing shadow-warning wording.
- Nested files inside mode dirs are ignored (matching the flat upstream glob).
- Imports are unchanged: only `~/.config/opencode/agents/` (project
  `.opencode/agents/`) is written; mode files are never synthesized, so a
  migrated mode becomes a regular (subagent-eligible) agent on the target —
  the export warning tells the user to review.

## Deferred (unchanged from ROUND-131)

- `OPENCODE_CONFIG_DIR` / `OPENCODE_CONFIG_CONTENT` overrides.
- Plugin-provided agents/commands.
- Agents/commands defined inline in `opencode.json`.
