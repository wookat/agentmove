# GAP-ROUND-36 — 文档准确性走查（introduction/limitations 严重滞后）

日期：2026-08-06 · 类型：文档修正轮（用户数据 + UX 走查触发）

## 1. 真实用户数据（npm API，不造假）

- last-week 下载：08-04 = 131，**08-05 = 1607**（增长显著，来源未知，
  可能被收录进某个 registry 镜像/榜单；持续观察）。
- latest = 0.12.0；hermes-agent 仍 0.19.0（竞品无动向）。

## 2. 发现的 P1 文档缺口（实测线上页面）

- `/docs/introduction/`：Supported clients 仍只列 **6 个**（0.3.0 时代），
  实际已 14 个。新用户第一入口页信息错误。
- `/docs/limitations/`：整页停留在 "as of v0.1"：
  - Scope 一节声称「只支持用户级、project 在 roadmap」——`--project`
    0.3.0 已发布，纯错误信息；
  - Memory 表缺 8 个客户端（qwen/goose/windsurf 等）；
  - Skills 一节没提 opencode/qwen/goose 原生 skills；
  - MCP disabled/注释保留说明未覆盖新客户端。

## 3. 修复

- introduction.md：客户端列表更新为 14 个。
- limitations.md：去掉 v0.1 措辞；Memory 表补齐 14 客户端边界；
  Skills 列出原生支持者与跳过者；MCP 边缘补 disabled/goose/JSONC；
  Scope 改为如实描述 `--project`（openclaw/hermes 除外）。

纯文档轮，无 changeset（不发版）；合并后官网重部署即可生效。

## 4. 验证

website build 通过；页面内容与 README/clients 页交叉核对一致。
