# GAP-ROUND-34 — 第 13 客户端：Qwen Code

日期：2026-08-06 · 类型：开发版轮（竞品/生态调研触发）

## 1. 证据（官方文档 + 源码实测调研）

- https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/ ：
  用户配置 `~/.qwen/settings.json`，`mcpServers` 顶级键（Gemini CLI fork，
  同结构）；项目配置 `.qwen/settings.json`；context 文件 `QWEN.md`。
- https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/ ：
  原生 Agent Skills：个人 `~/.qwen/skills/<name>/SKILL.md`，项目
  `.qwen/skills/`。
- 源码（QwenLM/qwen-code packages/core/src/memory/const.ts）：
  `MEMORY_SECTION_HEADER = '## Qwen Added Memories'` —— 保存的记忆写入
  QWEN.md 的该节，与 Gemini "Gemini Added Memories" 同机制。
- 价值判断：Qwen Code 是 npm 上下载量最大的开源 coding agent CLI 之一
  （@qwen-code/qwen-code），MCP+context+memory+skills 四层齐备。

## 2. 实现

- 用户级 adapter `qwen`：`mcpServers` 读写（merge 语义、脱敏、
  disabled 无标志 warning）；QWEN.md instructions + "Qwen Added Memories"
  memory 层双向 round-trip；原生 skills 目录直迁；persona 近似（warning）。
- 顺带修复（真实缺口）：`parseCommonMcpEntry` 现接受 `httpUrl`
  （Gemini CLI/Qwen 的 streamable-HTTP 拼写）——此前 gemini/qwen 配置里
  仅有 `httpUrl` 的远程 server 会被误判为无 command 的 stdio 而丢弃。
- 项目级：`.qwen/settings.json` + `QWEN.md` + `.qwen/skills`。
- 全矩阵 e2e 扩至 13×13（156 方向）+ 全目标 round-trip 13 个。

## 3. 诚实边界

- Qwen 无 per-server disabled 标志（warning）；system-defaults/system
  settings（/etc/qwen-code）不迁移——机器级配置超出用户迁移范围。

## 4. 验证

见 PR 记录：build/lint/typecheck/tests/coverage/website build。
minor changeset 已加（合并后可发 0.11.0）。
