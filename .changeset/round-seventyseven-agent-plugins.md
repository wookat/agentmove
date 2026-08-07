---
"agentmove-cli": minor
---

Agent Plugins 1.0.0 interop: `export <client> --plugin` writes a conformant Agent Plugin (plugin.json + skills/ + mcp.json with explicit stdio/streamable-http/sse types), and `import -i <dir>` auto-detects Agent Plugin directories so any plugin from the ecosystem can be imported into all supported clients. Layers with no plugin slot (instructions, persona, memory) and absolute cwd values are skipped with honest warnings.
