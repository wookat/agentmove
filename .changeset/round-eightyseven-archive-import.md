---
"agentmove-cli": minor
---

Archive import: `import <client> -i <file-or-url>` now accepts `.zip`, `.tgz`,
and `.tar.gz` archives — GitHub release assets, repository "Download ZIP"
links, or local files. The archive is downloaded (for URLs) and extracted, a
single top-level wrapper directory is unwrapped, and the contents go through
the existing auto-detection (Agent Plugin, agentmove bundle, skills
repository, standalone mcp.json). Corrupt archives are a data error (exit 3).
