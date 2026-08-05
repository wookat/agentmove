# GAP-ROUND-14 — 干净环境 0.2.1 脱敏验证 + 坏输入健壮性抽查

日期：2026-08-05 · 参照物：发布产物实测 + 生产级基线第 3 条（健壮性）

## 1. 干净环境 0.2.1 脱敏验证（实测）

```console
$ npx -y agentmove-cli@0.2.1 --version
0.2.1
$ npx -y agentmove-cli@0.2.1 --home $H export openclaw -o b
warning: mcp:remote.headers.Authorization: likely secret replaced with a ${VAR} placeholder (use --include-secrets to keep)
$ grep -A2 '"headers"' b/mcp-servers.json
    "headers": { "Authorization": "${Authorization}" }     # 默认脱敏 ✅
$ npx -y agentmove-cli@0.2.1 --home $H export openclaw -o b2 --include-secrets
    "headers": { "Authorization": "Bearer abc123" }        # 显式保留 ✅
```

ROUND-13 的 P1 安全修复在发布产物上确认生效。

## 2. 坏输入健壮性抽查（built CLI 实测）

| 场景 | 结果 | exit |
| --- | --- | --- |
| 全空 home `doctor` | 六客户端全部 not detected，正常列表 | 0 |
| 损坏 TOML（codex） | `error: <path>: Invalid TOML document: ...`，单行、带路径 | 3 |
| 损坏 YAML（hermes） | `error: <path>: Flow sequence ... line 3, column 1`，带路径 | 3 |
| 空 `GEMINI.md` + 空 settings | 正常导出 0 项，无崩溃 | 0 |
| bundle 缺 manifest.json | `not an agentmove bundle (missing manifest.json)` | 3 |
| manifest schemaVersion=99 | `unsupported bundle schema (expected schemaVersion 1)` | 3 |
| `diff` 自比较 | 空 diff | 0 |

无堆栈泄漏、无崩溃，exit code 契约全部符合。未发现新 P0/P1/P2。

## 3. 回归结论（诚实）

0.2.1 发布链路（发布→干净环境安装→脱敏行为）完整闭环；健壮性抽查未发现缺陷。
本地可修复缺口持续为零；唯一开放项仍为 npm provenance（A4，需 npm org 侧配置）。
