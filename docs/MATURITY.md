# 成熟化清单（Wave 2 · 总负责人下达，对标 agentgate/docs/MATURITY.md）

目标：达到「用户敢把自己的 agent 数据交给它搬家」的可信度。验收以本清单逐项对照，每项完成在 PR 描述中引用条目。

## A · 工程与发布
- [x] A1 发布工程：changesets（semver + CHANGELOG 自动化）+ GitHub Actions 发布流水线（tag → npm publish，需 NPM_TOKEN secret）
- [x] A2 覆盖率门禁：核心覆盖率 ≥80% 并在 CI 强制（vitest coverage thresholds）
- [x] A3 真实环境 e2e：子进程运行已构建 CLI，对真实 home 目录布局做 export → import --apply → 再 export 的 round-trip 校验（含备份、dry-run、secrets redaction）
- [ ] A4 npm provenance（OIDC trusted publishing）——需 npm org 侧配置
- [x] A5（部分）健壮性：exit code 契约（0/1/2/3）+ 解析错误带文件路径 + MCP merge 语义（ROUND-1，PR #5）；`--debug` 诊断仍待做

## B · 文档与诚实边界
- [x] B1 memory/persona 迁移能力边界如实成文（docs 站 limitations 页 + README「What does NOT migrate」节）
- [x] B2 演示 GIF（终端录制）入 README 与官网
- [ ] B3 文档搜索已有（Pagefind）；SEO/OG 卡片待补
- [ ] B4 无障碍与 Lighthouse ≥90

## C · 社区治理与增长
- [x] C1 治理文件：CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / SUPPORT / GOVERNANCE / ROADMAP、issue & PR 模板
- [x] C2 发布内容包草稿（docs/launch/：Show HN、Reddit、V2EX——仅草稿，发布动作等总负责人指令）
- [ ] C3 OpenSSF Best Practices Badge 自评并提交
- [ ] C4 Dependabot/Renovate、stale bot

## 公共
- 一切走 PR + CI 绿后合并。
