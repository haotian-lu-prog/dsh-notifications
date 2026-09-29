# HANDOFF

> 三家的接力棒：DSH / Codex / Claude Code 都读这个文件。**开工先读，收工必更新并提交。**

## 当前写者

- 工具：DSH
- 分支：main
- 开始时间：2026-09-29 18:00 (+09:00)

> 一个仓库同一时刻只允许一个写者。交接时把上一行改成自己，并先读完下面的状态。

## 当前状态

- 从上游 `linbin-mk/dsh-notify` **0.4.0**（commit `179bc55`）fork，保留全部 git 历史。
- 改名完成：npm 包名 `dsh-notifications`，profile 入口 id / `ENTRY_ID` / 客户端模块 id / 原生 helper 名（`native/dsh-notifications-menubar`）全部对齐；`client.js` 的模块 id 与包名一致，正是 Harness 索引客户端模块表要求的形态。
- 兼容性核对：`0.1.7-rc.2` → `0.2.0-rc.1` 之间，本插件触达的 9 个 `@deepseek-ai/*` 包**只有 `dsh-api-remotes` 的 client 多出一行纯类型再导出**，其余逐字节相同（仅 `package.json` 版本号变化）。所以 peer 放宽为 `^0.1.7-rc.2 || ^0.2.0-rc.1`，两个运行时都无需"精确版本豁免"。
- 本地验证：`npm test` 13/13 通过（含原生 helper 探测）；`npm pack` 产出 72 KB tarball，内含已编译的通用二进制。
- 署名：`LICENSE` / `NOTICE` 保留上游版权，并写明本 fork 的修改版权与来源。
- 发布状态：GitHub 仓库已建（public）；npm `1.0.0` 待发布（本机 `~/.npmrc` 的 token 已失效，`npm whoami` 返回 401，需重新 `npm login`）。
- dsh market 投稿：已确认投稿方式是往 `awesome-dsh-plugin/awesome-dsh-plugin` 的 `data/plugins/<owner>__<repo>.yml` **加一个文件**（不是编辑 README），且 **CI 要求仓库创建满 1 天**，因此 PR 需在建仓次日再开。

## 下一步

- [ ] 发布 npm `dsh-notifications@1.0.0`（先 `npm login`，再 `npm publish --access public`）
- [ ] 给 GitHub 仓库加 `dsh-plugin` topic
- [ ] 建仓满 24 小时后，提交 `data/plugins/haotian-lu-prog__dsh-notifications.yml` 并开 PR
- [ ] （可选）在隔离 profile 里跑一次 DSH `0.2.0-rc.1` 的端到端启动验证（`.e2e/` 已就绪）

## 未决问题

- 上游是否愿意接受一个"面向 0.2.0-rc.1 的兼容性 PR"？本 fork 先走独立发布；若上游愿意接收 peer 放宽，可以回头提 PR 减少生态分叉。
- 版本线起点：fork 自 `1.0.0` 起算（npm 上 `dsh-notifications` 这个名字曾被他人发过 `0.5.0` 后撤回，故避开 0.5.x）。
