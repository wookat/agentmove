# GAP-ROUND-10 · 官方 CLI 互操作深度验证（2026-08-05）

方式：`convert openclaw <target> --apply` 到隔离 home，用目标官方 CLI 实际读取迁移产物。

## 实测矩阵

| 目标 | 官方 CLI 验证命令 | 结果 |
|---|---|---|
| codex | `CODEX_HOME=… codex mcp list` | ✅ 两个 server（stdio `docs` + HTTP `remote`）均被识别并 enabled；`AGENTS.md`（instructions+persona+memory 近似迁移）被 codex 实际加载 |
| gemini | `HOME=… gemini mcp list` | ✅ 两个 server 被识别（untrusted folder 下默认 Disabled，属 gemini 安全策略，非格式问题） |
| claude-code | `HOME=… claude mcp list` | ✅ 两个 server 被识别并尝试连接（fixture 为示例地址，连接失败符合预期；解析/识别通过） |

结论：MCP/instructions/persona/memory 迁移产物均能被三家官方 CLI 正确解析，往返语义与 ROUND-1 建立的 merge 契约一致。

## 差距清单

本轮未发现新的 P0/P1。未覆盖：OpenClaw/Hermes 官方 CLI（未发布公开安装包）、Cursor（GUI 应用，无 CLI 可验证）。

## 结论

互操作证据链闭合；剩余唯一开放项仍为 npm provenance（A4，需 npm org 配置）。
