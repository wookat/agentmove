# GAP-ROUND-18 — 依赖健康轮：Dependabot 首批 PR 实测 + TS7 迁移评估

日期：2026-08-05 · 参照物：Dependabot #27/#28/#29 · TypeScript 7.0.2（tsgo 原生版）

## 1. Dependabot PR 本地实测

| PR | 依赖 | 实测 | 结论 |
| --- | --- | --- | --- |
| #27 | pnpm/action-setup 4→5 | build/lint/typecheck/43 测试全绿 | 可合并 |
| #29 | commander 14→15 | 全绿 | 可合并 |
| #28 | typescript 5.9.3→7.0.2 | **失败** | 搁置（见下） |

## 2. TS7 迁移评估（实测）

- 症状：`TS2591: Cannot find name 'node:path'`（TS7 不再自动加载 @types/node）。
- 修法已验证：tsconfig 加 `"types": ["node"]` 后 `tsc --noEmit` 通过。
- **真正阻塞**：typescript-eslint 8.65 明确拒绝 TS 7.0：
  ```text
  typescript-eslint does not support TS 7.0.
  See https://github.com/typescript-eslint/typescript-eslint/issues/10940
  （官方 tracking：TS >=7.1 才支持）
  ```
- 结论：等 typescript-eslint 支持 TS 7.1 后一并迁移（types 修法已备好）。
  Dependabot 配置加 ignore：typescript 的 major 升级暂不提 PR。

## 3. 官网重部署

og.png / favicon.svg 已随 wrangler pages deploy 上线并验证
（https://agentmove.zalize.com/og.png 200，og:image meta 生效）。

## 4. 结论

依赖升级通道打通（首批 2/3 可合并，1 个有据搁置）；无新 P0/P1。
