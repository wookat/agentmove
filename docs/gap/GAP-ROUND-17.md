# GAP-ROUND-17 — B4 Lighthouse/无障碍实测（官网四页全 100）

日期：2026-08-05 · 参照物：MATURITY B4（Lighthouse ≥90）

## 1. 实测（lighthouse CLI，本地构建产物）

```console
$ npx lighthouse http://localhost:4321/<page> --only-categories=performance,accessibility,best-practices,seo
/                   performance:100 accessibility:100 best-practices:96→100 seo:100
/docs/quick-start/  performance:100 accessibility:100 best-practices:100 seo:100
/docs/commands/     performance:100 accessibility:100 best-practices:100 seo:100
/docs/limitations/  performance:100 accessibility:100 best-practices:100 seo:100
```

## 2. 发现并修复

首页 best-practices 96 的唯一原因：`/favicon.svg` 404（Starlight 默认引用但
public/ 缺文件，控制台报错）。补 `website/public/favicon.svg` 后复测 100。

## 3. 结论

B4 达成（全部页面四项 100，门槛 ≥90）。MATURITY 本地可做项清零；
仍开放：A4 npm provenance（org 配置）、C3 OpenSSF 徽章（对外提交，等指令）。
