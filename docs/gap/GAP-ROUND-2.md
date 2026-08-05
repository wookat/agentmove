# GAP-ROUND-2 · 生产级对标（2026-08-05）

参照物（实际运行）：
1. **codex CLI `mcp list --json`**：官方 CLI 为脚本/CI 提供机器可读输出。
2. **npm audit `--json`**、**pandoc 机器可读格式列表**：生产级 CLI 的标配是人类/机器双输出。

## 差距清单

| # | 竞品做到了什么 | 我们现状（ROUND-1 后） | 差距 | 优先级 |
|---|---|---|---|---|
| 1 | `codex mcp list --json` / `npm audit --json` 全量机器可读 | 仅人类可读输出 | CI/脚本无法消费 doctor/diff/迁移计划 | **P1** |
| 2 | 官方迁移工具输出结果摘要 | `--apply` 只说 "wrote N file(s)" | 用户不知道各层迁移了多少 | **P1** |
| 3 | 主流 CLI 支持 Node LTS 双版本 | engines/CI 均只有 Node 22 | Node 20 LTS 用户被 engines 挡住 | **P1** |
| 4 | 生产级工具有真实规模性能数字 | 从未测过 | 无性能证据 | **P1** |

## 本轮修复

1. `doctor --json` / `diff --json` / `import --json` / `convert --json`（计划、警告、摘要、backupDir 全量 JSON；stderr 不再混入 warning）。
2. `--apply` 后输出 `migrated: N MCP server(s), N skill(s), N memory entr(ies)[, instructions][, persona]` 摘要。
3. engines 降到 `>=20`；CI 在 Node 22 上构建（pnpm 11 自身要求 Node >=22），再用 Node 20 以最终用户方式运行已构建 CLI 做冒烟验证。
4. 性能实测（合成真实规模 home：100 MCP servers + 100 skills + 366 天 daily memory + 200KB MEMORY.md，共 3.5MB）：
   - `export openclaw` ≈ **137ms**
   - `convert openclaw hermes --apply`（写 103 文件+备份）≈ **117ms**
   - 结论：典型规模下均 <150ms，无性能风险。

## 回归结论（新用户视角）

`npx agentmove-cli doctor --json | jq` 可直接进脚本；apply 后能看到分层迁移摘要。相比 pandoc/官方 CLI 仍缺：`--debug` 诊断模式、Windows 实测、npm provenance → 列入 ROUND-3 候选。
