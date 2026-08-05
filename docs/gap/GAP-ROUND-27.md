# GAP-ROUND-27 — 加密传输：pack / unpack（roadmap 长期项落地）

日期：2026-08-04 · 参照物：age/gpg 的单文件加密传输体验、pandoc 的单文件输出

## 0. 前置：v0.7.0 发布与干净环境回归

- v0.7.0 Release 已建：https://github.com/wookat/agentmove/releases/tag/v0.7.0
- `npx agentmove-cli@0.7.0` 干净环境回归通过（重点 OpenHands）：
  - doctor 识别 OpenHands（2 servers + instructions）；
  - export 默认脱敏 api_key→`${Authorization}`；
  - openhands→zed convert 正常（stdio 补 args:[]）；
  - `--only instructions` 导入前后 config.toml md5 相同（no-op TOML write OK）。

## 1. 差距

真实场景：换电脑/多机携带 agent 需要把 bundle（目录）经由邮件/网盘等不可信通道传输。
竞品体验参照 age/gpg：单文件、口令加密、认证失败即报错。我们此前只有明文目录。

## 2. 实现

- 新命令 `pack <bundle> [-o file]` / `unpack <file> [-o dir]`：
  gzip(JSON bundle) → AES-256-GCM，key 由 `AGENTMOVE_PASSPHRASE` 经 scrypt
  (N=2^15, r=8, p=1) 派生；文件头 `AMPACK1\n` + salt(16) + iv(12) + tag(16)。
- `import -i` 自动识别 .agentpack 文件（magic 检测），免手工 unpack。
- 错误契约：缺口令 exit 2；错口令/篡改（GCM 认证失败）exit 3，单行报错。
- 仅用 node:crypto/node:zlib，零新依赖。

## 3. 验证

- 80 测试全绿（新增 pack 单测 5 + e2e 1：往返、随机 salt/iv、错口令、篡改、
  非 pack 文件、CLI 全链路含 import 直读 pack）；coverage 83.03/67.04（门禁 80/65）；
  build/lint/typecheck/website build 通过；man/completion/README/官网同步；minor changeset。

## 4. 结论（诚实）

口令强度由用户负责；bundle 默认已脱敏，`--include-secrets` 导出的 bundle 打包后
密文可保护传输，但口令管理需自行谨慎（文档已注明）。未实现 PAM 级签名/能力控制。
