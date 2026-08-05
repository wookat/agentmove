# GAP-ROUND-29 — 深度对标：CLI UX（gh/pnpm 标杆）+ 官网移动端核查 + 竞品复测

日期：2026-08-05 · 参照物：gh CLI、pnpm 的帮助/错误/建议体验

## 1. 竞品复测

- hermes-agent 仍为 0.19.0（npm time.modified 2026-07-20，无新版本）；
- npm 无新的中立多向迁移工具出现；定位不变。

## 2. CLI UX 实测差距（对标 gh/pnpm）

| 项 | 竞品 | 我们（改前） | 结论 |
| --- | --- | --- | --- |
| 命令/选项拼错 | gh/pnpm 提示建议 | commander 已有 "Did you mean" | 已达标 |
| 拼错的 exit code | 用法错误统一 | commander 默认 exit 1，与我们文档承诺的 2 冲突 | **P1 修复**：CommanderError 统一映射 exit 2 |
| 未知 client | gh 对近似值给 did-you-mean | 只列全量列表 | **P1 修复**：编辑距离 ≤3 给 `did you mean "gemini"?` |
| --help 示例 | gh 每命令带 EXAMPLES | 无示例 | **P1 修复**：主 help 增 Examples 节 + 文档链接 |
| doctor 输出 | — | ✓/- 前缀 + 分层清单 + 警告缩进 | 已达标 |

## 3. 官网移动端与现代视觉核查

- `<meta name="viewport" content="width=device-width, initial-scale=1"/>` 存在；
- Lighthouse 移动端仿真（默认 moto G 移动配置）实测线上站：
  performance 99 / accessibility 100 / best-practices 96 / seo 100；
- best-practices 唯一扣分为本测试环境代理拦截产生的 `ERR_BLOCKED_BY_CLIENT`
  控制台错误（环境噪声，非站点资源问题）；
- Starlight 自带响应式布局/暗色模式/移动端抽屉导航，达标。

## 4. 验证

81 测试全绿（新增 1 项 e2e：拼错命令/选项 exit 2、client did-you-mean、help Examples）；
coverage 83.22/67.14（门禁 80/65）；build/lint/typecheck 通过；patch changeset 已加。

## 5. 结论（诚实）

CLI 帮助/错误/建议体验已对齐 gh/pnpm 同级；官网移动端有实测证据达标。
剩余开放项不变：watch mode（长期）、npm provenance（org 配置）、PAM（不实现声明）。
