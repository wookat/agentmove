---
"agentmove-cli": patch
---

Fix the shipped man page never being linked by npm: npm only links man files
whose basename matches the package name, so `man/agentmove.1` is renamed to
`man/agentmove-cli.1`. After a global install, `man agentmove-cli` now works.
