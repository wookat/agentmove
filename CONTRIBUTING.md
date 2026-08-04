# Contributing to AgentMove

Thanks for helping people keep ownership of their agents!

## Development setup

```bash
pnpm install
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Node >= 22 and pnpm are required. Tests run against fixture home directories in
`packages/agentmove/test/fixtures/` — no real agent data is ever touched.

## Adding a client adapter

1. Implement the `ClientAdapter` interface in `packages/agentmove/src/adapters/<client>.ts`.
2. Register it in `adapters/index.ts` and add the id to `CLIENT_IDS` in `model.ts`.
3. Add a fixture home under `test/fixtures/<client>-home/` and export/import tests.
4. Document the storage layout (with sources) in `docs/research/FORMAT-MATRIX.md`
   and the website's Supported clients page.

Ground rules:

- **Never write files directly from an adapter** — return `FilePlan[]` from
  `planImport` so dry-run/backup/diff keep working.
- **Never drop data silently** — every lossy or approximated mapping must emit a
  warning.
- Verify formats against official docs or real installs; cite sources in the
  format matrix.

## Pull requests

- Keep changes focused; include tests.
- Add a changeset for user-facing changes: `pnpm changeset`.
- CI (build/lint/typecheck/test + coverage gate) must be green.

## Reporting bugs / security

Bugs: GitHub issues. Vulnerabilities: see [SECURITY.md](SECURITY.md) — please
don't open public issues for security problems.
