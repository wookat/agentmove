# GAP ROUND-125: OpenHands user-level Agent Skills (`~/.agents/skills` + legacy `~/.openhands/skills`)

## Signal

- OpenHands app (All-Hands-AI/OpenHands) skill scope logic
  (`src/utils/skill-scope.ts`) recognizes `~/.agents/skills/`,
  `~/.openhands/skills/`, and `~/.openhands/microagents/` as personal skill
  roots, and their project-relative counterparts as project skills.
- OpenHands agent SDK (OpenHands/software-agent-sdk,
  `openhands-sdk/openhands/sdk/skills/skill.py`):

  ```python
  USER_SKILLS_DIRS = [
      Path.home() / ".agents" / "skills",
      Path.home() / ".openhands" / "skills",
      Path.home() / ".openhands" / "microagents",  # Legacy support
  ]
  ```

  Duplicate names are merged with earlier entries winning
  (`.agents/skills` > `.openhands/skills` > `microagents`). Project skills
  load from `{work_dir}/.agents/skills/`, `{work_dir}/.openhands/skills/`,
  and `{work_dir}/.openhands/microagents/` with the same precedence, and the
  SDK docs say "Use .agents/skills for new skills. .openhands/skills is the
  legacy OpenHands location."
- `load_skills_from_dir` supports both the AgentSkills standard
  (`skills/<name>/SKILL.md`) and the OpenHands flat `skills/*.md` format.
- Installed skills managed via `install_skill` live in
  `~/.openhands/skills/installed/` (`skills/installed.py`) — a client-managed
  store, loaded with lower priority.

## Previous agentmove behavior

- User scope: skills were **skipped** with a warning claiming OpenHands
  skills only live in repositories. That was stale — user-level skills are
  supported upstream.
- Project scope: only `.openhands/skills/` was read/written; the preferred
  `.agents/skills/` root was ignored.

## Decision (this round)

- User export reads `~/.agents/skills/` and legacy `~/.openhands/skills/`,
  merging by skill name with `.agents/skills` winning (shadowed legacy copy
  warned). The managed `installed/` entry under the legacy root is skipped
  with a warning (client-owned install store).
- User import writes `~/.agents/skills/` (the upstream-preferred root, also
  the shared cross-agent root already used by Zed/VS Code/Codex adapters).
- Project scope reads both `.agents/skills/` and `.openhands/skills/` with
  the same precedence; imports now write `.agents/skills/`.
- `~/.openhands/microagents/` keeps its existing mapping to the
  instructions layer (it predates skills and holds prose microagents); it is
  not double-read as skills.

## Deferred (honest)

- OpenHands flat `skills/*.md` (OpenHands-format keyword/task-trigger
  skills): not part of the AgentSkills standard; trigger semantics are
  client-specific. Not migrated this round.
- `~/.openhands/skills/installed/` contents: managed by the client's
  install/uninstall flow with enable/disable state; copying them out would
  lose that state. Warned, not exported.
