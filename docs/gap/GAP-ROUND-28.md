# GAP-ROUND-28 — 维持轮：0.8.0 干净环境回归、性能复测、竞品动向、文档补齐

日期：2026-08-04 · 类型：维持性小轮（证据轮 + 文档）

## 0. v0.8.0 发布与干净环境回归（重点 pack/unpack）

- v0.8.0 Release 已建：https://github.com/wookat/agentmove/releases/tag/v0.8.0
- `npx agentmove-cli@0.8.0` 干净环境实测：
  - `pack` 产出以 `AMPACK1` 开头的密文文件，grep 无明文（`mcp.example` 0 命中）；
  - 错口令 `unpack`：单行报错 + exit 3；
  - 缺口令：单行指引 + exit 2；
  - `import -i agent.agentpack --apply` 直读密文包成功迁移（hermes 2 文件）。

## 1. 性能复测（10 客户端规模，真实规模输入）

100 MCP servers + 100 skills + 366 天 memory + 500 行 instructions：

| 操作 | 耗时 |
| --- | --- |
| export（openclaw） | 116 ms |
| pack（含 scrypt N=2^15） | 143 ms |
| unpack | 145 ms |
| convert openclaw→openhands --apply | 91 ms |

pack 文件 5.3 KB（gzip 后加密）。全部 <150ms，与 ROUND-2 基线一致，10 客户端无回退。

## 2. 竞品动向复测

- hermes-agent 仍为 0.19.0（无变化）；
- npm 搜索 "agent config migrate" 前 10 结果无新的中立多向迁移工具（均为无关的 db/ts 迁移器）；
- 定位不变：AgentMove 仍是唯一双向多客户端中立迁移器。

## 3. 文档补齐

- safety 页新增「Encrypted transport」节（加密语义、认证失败 exit 3、命令页链接）。

## 4. 结论（诚实）

无新 P0/P1。roadmap 剩余开放项：watch mode（长期）、npm provenance（需 org 配置）、
PAM（超出内部 memory 模型，维持不实现声明）。
