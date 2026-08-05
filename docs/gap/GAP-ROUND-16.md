# GAP-ROUND-16 — 干净环境 0.2.2 回归 + MATURITY 补项（B3 OG/SEO、C4 Dependabot）

日期：2026-08-05 · 参照物：发布产物实测 + MATURITY 清单

## 1. 干净环境 0.2.2 回归（实测）

```console
$ npx -y agentmove-cli@0.2.2 --version
0.2.2
$ npx -y agentmove-cli@0.2.2 --home $H export openclaw -o b        # 全量
$ echo "user file" > b/NOTES.txt
$ npx -y agentmove-cli@0.2.2 --home $H export openclaw -o b --only mcp
$ ls b
NOTES.txt config.json manifest.json mcp-servers.json memory        # 无残留 ✅
# instructions.md / persona.md / skills/ 已清理；用户文件 NOTES.txt 保留 ✅
```

ROUND-15 clean re-export 修复在发布产物上确认生效。

## 2. 竞品动向复测

`npm view agentmove-cli version` → 0.2.2；`npm view hermes-agent version` → 0.19.0
（无变化，claw migrate 仍单向）。无新中立迁移工具出现。

## 3. 本轮补项（MATURITY）

- **B3 SEO/OG 卡片**：官网新增 `og.png`（1200×630）与 og:image / twitter:card
  meta（Starlight `head` 配置），构建后 HTML 已验证包含标签。
- **C4 Dependabot**：`.github/dependabot.yml`（npm 每周 + dev 依赖分组 +
  github-actions 每周）。

仍开放：A4 npm provenance（需 org 配置）、B4 Lighthouse 评分、C3 OpenSSF 徽章
（需对外提交，等总负责人指令）。

## 4. 回归结论（诚实）

0.2.2 发布链路闭环；本轮无新 P0/P1。MATURITY 本地可做项仅剩 B4（Lighthouse
实测），下一轮候选。
