# GAP-ROUND-12 — 竞品动向复测 + 真实用户场景：部分迁移（--only）

日期：2026-08-04 · 参照物：hermes claw migrate、pandoc 选项设计、npm registry 新工具扫描

## 1. 竞品动向复测（实测）

```console
$ npm view hermes-agent version
0.19.0        # 与 ROUND-11 持平，claw migrate 仍为单向迁入，定位未变
$ npm search "agent migrate mcp" --json | head
mcp-use / agent-install / notion-mcp-server / firecrawl-mcp ...
# 无新出现的中立多向迁移工具；AgentMove 定位仍唯一
```

## 2. 真实用户场景差距

| 场景 | 竞品/参照 | 我们现状（本轮前） | 差距 | 优先级 |
| --- | --- | --- | --- | --- |
| 部分迁移（只迁 MCP / 只迁 skills） | pandoc 可用 `--extract-media`、`--strip-comments` 等细粒度控制；官方 `claude mcp add` 天然只动 MCP | 只能全量迁移，用户想"只把 MCP 搬过去"必须接受 instructions/skills 一起写入 | **P1**：缺层过滤 | ✅ 本轮修复 |
| dry-run diff 预览 | pandoc 无 dry-run（直接输出）；hermes migrate apply 前强制预览 | `import/convert` 默认 dry-run 列出将写文件 + `diff` 独立命令 + `--json` 全计划 | 已达标（优于 pandoc，与 hermes 同级） | 无 |
| 多机同步 | 无竞品做双向同步 | bundle 目录可 commit 进 git / 拷到另一台机（README 已述）；无 watch/自动同步 | P2（超出迁移工具边界，暂不做，诚实标注） | 记录 |

## 3. 本轮修复：`--only <layers>`（P1）

`export` / `import` / `convert` 新增 `--only mcp,skills,memory,instructions,persona`：

```console
$ agentmove --home $H convert openclaw codex --only mcp
dry-run: would write 1 file(s) under $H (use --apply to write):
  ~/.codex/config.toml        # 全量时还会写 AGENTS.md + skills
$ agentmove --home $H export openclaw --only nope
error: unknown layer "nope" (expected one of: mcp, skills, memory, instructions, persona)
# exit 2（usage error 契约）
```

- 语义：过滤 bundle 层；`--only mcp` + 默认 merge 语义 = 与官方 `mcp add` 等价的最小侵入迁移。
- completion（bash/zsh/fish）与 man page 均覆盖新 flag；README/官网 commands 页已更新。
- e2e 新增：`--only mcp` summary 归零其余层、`--only skills,persona` 只写 SKILL.md、未知层 exit 2。

## 4. 官网文档与 0.1.2 对齐核查

逐页核对 quick-start / commands / safety / limitations：0.1.2 能力（--json、clients、
completion、man、--debug、merge 语义）均有文档且与实现一致；本轮同步补入 `--only`。

## 5. 回归结论（诚实）

部分迁移补齐后，「只搬 MCP」这一最高频真实场景达到官方 `mcp add` 级的最小侵入体验；
dry-run/diff 预览已优于 pandoc（其无 dry-run）。仍不如竞品处：无（本领域无更强竞品）；
自身边界：多机自动同步不做（P2 记录）、memory/persona 限制不变（limitations 页）。
