# GAP-ROUND-38 — 第 16 客户端：Claude Desktop

日期：2026-08-06 · 类型：开发版轮（数据+生态触发）

## 1. 数据与证据

- 真实 npm 数据（downloads API）：08-04=131 → 08-05=1607，新用户涌入期。
- Claude Desktop 是安装量最大的 MCP 宿主之一，官方 MCP 文档
  （modelcontextprotocol.io/docs/develop/connect-local-servers）实测确认：
  - macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows：`%APPDATA%\Claude\claude_desktop_config.json`
  - Linux（非官方构建）：`~/.config/Claude/claude_desktop_config.json`
  - 根键 `mcpServers`，通用 `command`/`args`/`env` 形状。
- 用户高频真实场景：Claude Desktop 里配好的 MCP servers 想搬到
  Claude Code/Cursor/goose 等 CLI（或反向），此前需手抄 JSON。

## 2. 实现

- adapter `claude-desktop`：export/detect 依次检查三个平台位置；
  import 写回已存在的位置，否则按当前平台默认位置。
- merge 语义 + 脱敏 + `--replace-mcp` 与其他客户端一致。
- 诚实边界（全部 warning）：instructions/memory/projects 均为
  app 内管理不可迁移；无 disabled flag；remote server 以 url 形式
  写出（代理用法提示）；无项目级 scope。
- 全矩阵 e2e 扩至 16×16（240 方向）+ 16 目标 round-trip。

## 3. 验证

build/lint/typecheck 通过；102 tests 全绿；website build 通过。
minor changeset 已加（合并后可发 0.14.0）。
