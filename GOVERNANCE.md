# Governance

AgentMove is maintained by the Zalize team (repository owner: @wookat).

- **Decision making**: maintainers decide by lazy consensus on issues/PRs.
  Anything without objections from a maintainer within a week can be merged.
- **Becoming a maintainer**: sustained quality contributions (adapters, tests,
  docs) — nominated and approved by existing maintainers.
- **Releases**: cut from `main` via changesets; see `.github/workflows/release.yml`.
- **Scope**: neutral, local-only migration between agent clients. Features that
  lock users into one vendor or require a network service are out of scope.
