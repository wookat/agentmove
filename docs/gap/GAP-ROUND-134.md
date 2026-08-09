# GAP-ROUND-134: Continue inline prompts/rules (config.yaml + yaml block files)

## Gap

Continue defines slash commands and rules not only as markdown files under
`~/.continue/prompts/` and `~/.continue/rules/`, but also:

1. **Inline in `~/.continue/config.yaml`**: `prompts:` (name/description/prompt)
   and `rules:` (string, or object with name/rule/globs/regex/alwaysApply/
   invokable) arrays.
2. **Local YAML block files**: continue loads `*.yaml` block files from every
   block-type directory in both `~/.continue/<type>/` and workspace
   `.continue/<type>/` — including `prompts/` and `rules/`. Each block file is
   a ConfigYaml document whose `prompts:`/`rules:` arrays are merged in.

agentmove previously read only the markdown files, silently omitting inline
prompts and rules.

## Upstream evidence (continuedev/continue @ main, 2026-08)

- `packages/config-yaml/src/schemas/index.ts`: `promptSchema`
  (`name`, `description?`, `prompt`, `sourceFile?`), `ruleObjectSchema`
  (`name`, `rule`, `description?`, `globs?`, `regex?`, `alwaysApply?`,
  `invokable?`, `sourceFile?`), `ruleSchema = z.union([z.string(),
  ruleObjectSchema])`; `configYamlSchema` allows `uses:` hub references in
  both arrays.
- `core/config/yaml/loadYaml.ts` (`loadConfigYaml`): local YAML block files
  are gathered for every block type via
  `getAllDotContinueDefinitionFiles(ide, { includeGlobal: true,
  includeWorkspace: true, fileExtType: "yaml" }, blockType)` and merged into
  the assistant config.
- `core/config/loadLocalAssistants.ts` (`getDotContinueSubDirs`): the block
  dirs are workspace `.continue/<subDirName>` plus `~/.continue/<subDirName>`.
- `core/config/yaml/loadYaml.ts`: `config.prompts?.forEach(...)` converts
  every prompt block via `convertPromptBlockToSlashCommand` — inline prompts
  are **unconditionally** slash commands (no `invokable` gate, unlike prompt
  markdown files).
- `core/config/workspace/workspaceBlocks.ts` (`getFileContent`): continue's
  own "new prompt" markdown template writes `invokable: true` + `description`
  frontmatter — the synthesized export shape matches the client's native
  template.
- `core/config/profile/doLoadConfig.ts`: markdown rules are `unshift`ed before
  config rules; rules with `invokable: true` are additionally converted to
  slash commands via `convertRuleBlockToSlashCommand`.

## Behavior implemented

- **Inline prompts → commands layer**: entries from `config.yaml` `prompts:`
  and `.continue/prompts/*.yaml` block files are exported as synthesized
  markdown prompts (`---` frontmatter = remaining fields + `invokable: true`,
  body = `prompt`). Markdown prompt files win name duplicates (shadowed inline
  entries warned). Each exported inline entry gets a warning naming its source
  file. `uses:` hub references and entries without a string name/prompt are
  skipped with warnings.
- **Inline rules → instructions layer**: string rules and object rules from
  `config.yaml` `rules:` and `.continue/rules/*.yaml` block files are appended
  to the merged instructions document as `<!-- rule: <src> <label> -->`
  sections; scoping metadata (`globs`, `regex`, `alwaysApply`, `invokable`)
  cannot be expressed there and is dropped with a warning. `uses:` references
  skipped with warnings.
- **Project scope**: `.continue/prompts/*.yaml` and `.continue/rules/*.yaml`
  block files are read the same way (the workspace does not load a
  `config.yaml`, so none is read at project scope).
- **Imports unchanged**: agentmove still writes only markdown prompt files and
  `rules/agentmove.md`; it never writes inline config entries.

## Deferred (honest)

- Hub `uses:` block resolution (remote registry fetch) — warned, not migrated.
- Invokable rules doubling as slash commands: exported once into instructions
  with the `invokable` metadata warning; not duplicated into commands.
- Other block types (`models`, `context`, `docs`, `data`) are client/model
  configuration, not portable layers.

## Tests

`test/continue.test.ts`: user-scope export (inline prompt exact synthesized
bytes, block-file prompt, markdown-wins shadowing, hub `uses:` skip, malformed
skip, string/object/hub rules with metadata warnings), project-scope block
files export.
