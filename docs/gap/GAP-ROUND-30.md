# GAP-ROUND-30 — 100 轮持续迭代模式首轮：真实体验走查 + 数据分析 + 文档补齐

日期：2026-08-05 · 类型：体验走查小轮

## 1. 真实体验走查发现

- **P2 修复**：`agentmove clients` 表格列宽硬编码（padEnd 12/14），
  "OpenAI Codex CLI"（16 字符）撑破 label 列导致路径列错位；改为按最长
  id/label 动态列宽，新增 e2e 断言全行路径列对齐。
- convert dry-run/警告/diff 输出走查无新缺陷；0.8.1 的 did-you-mean、
  Examples、exit code 契约在本地构建复验正常。

## 2. 用户/数据分析（真实数据）

- npm 周下载（2026-07-29 ~ 08-04）：131 次；已发布 13 个版本，latest 0.8.1。
- 结论：有真实自然流量；文档首屏（quick-start）是新用户主路径，值得持续打磨。

## 3. 文档补齐

- quick-start 增「换机器」一节（pack → import .agentpack 两条命令），
  此前该 0.8.0 能力只在 commands/safety 页可见，首屏路径缺失。

## 4. 竞品/官网

- hermes-agent 0.19.0 无变化（ROUND-29 刚复测，本轮不重复）；
- 官网移动端 Lighthouse 99/100/96/100（ROUND-29 实测，唯一扣分为环境代理噪声）。

## 5. 验证

81 测试全绿（clients 对齐断言并入既有用例）；coverage 83.22/67.14；
build/lint/typecheck/website build 通过；patch changeset 已加。
