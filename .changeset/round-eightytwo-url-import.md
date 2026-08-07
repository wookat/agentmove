---
"agentmove-cli": minor
---

URL import: `import <client> -i <url>` now accepts http(s) URLs. A `.json` URL
is fetched and imported as a standalone MCP config; any other URL is shallow
`git clone`d and auto-detected as an Agent Plugin or agentmove bundle
repository. Plain-http URLs emit an insecure-URL warning; fetch/clone failures
are data errors (exit 3). Teams can now share one hosted mcp.json or plugin
repo and import it directly into any of the 46 supported clients.
