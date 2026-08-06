# GAP-ROUND-32 — 官网线上滞后 P1：修复 + 自动部署闭环

日期：2026-08-05 · 类型：流程缺陷修复轮

## 1. 发现（真实线上走查）

- 实测 https://agentmove.zalize.com 首页 tagline 仍只列 6 客户端；
  `docs/commands/` 无 pack/unpack；`docs/clients/` 无 windsurf/cline/zed/openhands；
  `docs/quick-start/` 无 agentpack —— 线上内容停留在 ~0.3.x 时代，
  与已发布的 agentmove-cli 0.8.1 严重脱节（P1：新用户看到的文档缺一半功能）。
- 根因：官网部署是手工 `wrangler pages deploy`，ROUND-18 之后各轮只改了
  仓库内容、未重部署；无 CI 自动部署，属流程缺陷（人为步骤必然遗漏）。

## 2. 修复

- 立即修复：从最新 main 重新构建并手工部署，线上实测已更新
  （commands 页含 pack，首页含 OpenHands）。
- 长效修复：新增 `.github/workflows/deploy-website.yml` —— main 分支
  website/** 变更时自动构建并 `wrangler pages deploy`（也支持手动触发）。
  需要 repo secrets：`CLOUDFLARE_API_TOKEN`（Pages 编辑权限）与
  `CLOUDFLARE_ACCOUNT_ID`（ddff52d24ee44e21a021c15eaffcc86d）。
  secrets 配好前该 workflow 会失败，届时手工部署兜底。

## 3. 验证

- 手工部署后线上抽查：`docs/commands/` 含 pack ×9 处；首页 tagline 已含
  OpenHands；`docs/quick-start/` 含 agentpack。
- workflow 为纯新增文件，不影响现有 CI。
