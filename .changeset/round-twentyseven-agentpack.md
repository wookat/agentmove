---
"agentmove-cli": minor
---

Encrypted bundle transport: new `pack <bundle> [-o file]` and
`unpack <file> [-o dir]` commands turn a bundle into a single portable
`.agentpack` file encrypted with AES-256-GCM (key derived from the
`AGENTMOVE_PASSPHRASE` environment variable via scrypt), so an agent can be
carried across machines through untrusted channels. `import -i` accepts an
`.agentpack` file directly. Missing passphrase is a usage error (exit 2);
wrong passphrase or a tampered file fails authentication (exit 3).
