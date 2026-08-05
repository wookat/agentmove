---
"agentmove-cli": patch
---

`export` now removes bundle-owned files (manifest, config, mcp-servers,
instructions, persona, memory/, skills/) from the output directory before
writing, so re-exporting into the same directory (especially with `--only`)
no longer leaves stale layers behind. Files agentmove does not own are left
untouched.
