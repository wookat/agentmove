# GAP-ROUND-13 — 干净环境 0.2.0 回归 + P1 安全修复：Authorization header 未脱敏

日期：2026-08-05 · 参照物：干净环境实测 0.2.0 发布产物

## 1. 干净环境 0.2.0 回归（实测）

```console
$ npx -y agentmove-cli@0.2.0 --version
0.2.0
$ npx -y agentmove-cli@0.2.0 --home $H convert openclaw codex --only mcp
dry-run: would write 1 file(s) ... ~/.codex/config.toml      # 全量时还会写 AGENTS.md + skills
$ npx -y agentmove-cli@0.2.0 --home $H convert openclaw codex --only mcp --apply
backed up existing files to .../.agentmove/backups/...
migrated: 2 MCP server(s), 0 skill(s), 0 memory entr(ies)
# config.toml：目标端自有 linear/search 保留 + 导入 docs/remote（merge 语义 ✅）
$ npx -y agentmove-cli@0.2.0 --home $H export openclaw --only nope
error: unknown layer "nope" (expected one of: mcp, skills, memory, instructions, persona)
# exit 2 ✅
```

--only mcp + merge、备份、exit code 契约全部通过。

## 2. 回归中发现的 P1（安全）

迁移产物 `config.toml` 中出现明文：

```toml
[mcp_servers.remote.http_headers]
Authorization = "Bearer abc123"
```

`SECRET_KEY_RE` 只匹配 key/token/secret/password/credential，`Authorization`
（HTTP 凭据最常见的 header 名）与 `Cookie` 漏网 —— 默认脱敏承诺（safety 文档
「Env/header values whose names look like secrets are replaced」）与实际不符。

**修复**：正则加入 `authorization|cookie`；新增单测断言
`mcp:remote.headers.Authorization` 被脱敏为 `${Authorization}`；README/safety
文档同步。不用宽泛的 `auth`（会误伤 `GIT_AUTHOR_NAME` 等）。

## 3. 回归结论（诚实）

0.2.0 发布产物功能全部符合预期；本轮唯一缺陷为默认脱敏遗漏 Authorization
header（P1，已修复，随下个 patch 版本发布）。修复前的规避方式：不要把
`--include-secrets` 之外仍含 Authorization header 的 bundle 提交到共享仓库。
