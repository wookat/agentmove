---
title: Introduction
description: What AgentMove is and why it exists.
---

AgentMove migrates your AI agent's whole brain between clients:

- **Config** — default model and behavior settings
- **MCP servers** — normalized across JSON / JSON5 / TOML / YAML shapes
- **Skills** — `SKILL.md` directories, the de-facto cross-client standard
- **Memory** — long-term, daily, and user-profile entries
- **Persona & instructions** — `SOUL.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor rules

## Why

Vendor migration tools (like `hermes claw migrate`) are one-way doors: they import
*into* one vendor and never out. AgentMove is neutral and local-only — any
direction, between any pair of supported clients, with a portable bundle format
in between so you can also carry your agent to another machine or keep it in git.

## Supported clients

OpenClaw, Hermes Agent, Claude Code, OpenAI Codex CLI, Cursor, and Gemini CLI.
See [Supported clients](/docs/clients/) for exactly what is read and written for each.
