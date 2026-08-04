# Security Policy

AgentMove reads and writes local agent configuration, which can contain
credentials. We take that seriously.

## Supported versions

Only the latest minor release receives security fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability). Do **not** open a public issue.
You should get an initial response within 7 days.

## Design guarantees

- No network access at runtime: agentmove only reads/writes local files.
- Dry-run by default; `--apply` is explicit and backs up overwritten files.
- Likely secrets are redacted to `${VAR}` placeholders on export unless
  `--include-secrets` is passed.

If you find any behavior that violates these guarantees, treat it as a
vulnerability and report it privately.
