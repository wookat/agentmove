---
"agentmove-cli": minor
---

URL import polish: GitLab-style `/-/tree/<branch>[/<dir>]` URLs are recognized
(the `/-/` marker supports arbitrarily nested subgroups), and a pasted GitHub /
GitLab `blob` link to a `.json` file is rewritten to the raw file it renders
(`github.com/o/r/blob/…` → `raw.githubusercontent.com/…`, `/-/blob/` → `/-/raw/`)
so it imports as a config instead of failing on the HTML page.
