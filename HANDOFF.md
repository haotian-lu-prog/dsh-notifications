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
- **端到端验证通过（真实 DSH 0.2.0-rc.1）**：用 npm 上的 `@deepseek-ai/dsh@0.2.0-rc.1` 在隔离 `DSH_HOME` + `web` 模板 profile 里装本包 tarball，**无需版本豁免、无需 `allowBuilds`**；启动无 warn/error；原生 helper 进程已常驻（Host 半侧完整跑通）；启动 payload 里客户端模块以 `id: dsh-notifications` 注册且 bundle 取回 `HTTP 200`（与包名一致，正是上游 0.2.x 事故的根因）。证据：`docs/evidence/`。
- 署名：`LICENSE` / `NOTICE` 保留上游版权，并写明本 fork 的修改版权与来源。
- 消费者侧复验（2026-09-29 18:43）：`pnpm add dsh-notifications@1.0.0` 直接从 registry 安装成功（镜像外 +4 包 / 2.3s），**没有 allowBuilds 授权、没有 git prepare 报错**；装出的 `client.js` id、`cordis.patch.yml` 与通用原生二进制（含可执行位）均正确。
  完整性链条：本地 `npm pack` = npm registry tarball = GitHub Release asset，三者 shasum 全为 `d149ae39b87854640354da236f77faccd1150ce8`。
- 市场 npm 映射已核实：`awesome-dsh-plugin/scripts/probe-npm.mjs` 从仓库 HEAD 的 `package.json` 取包名，再要求 registry 的 `repository.url` 含该仓库路径。本包满足（`git+https://github.com/haotian-lu-prog/dsh-notifications.git`），合并后市场会直接展示 npm 安装命令与版本号，而不是源码构建命令。
- 发布状态：**已发布**。
  - npm：`dsh-notifications@1.0.0`（2026-09-29 18:32 +09:00）。registry tarball 的 shasum `d149ae39b87854640354da236f77faccd1150ce8` 与本地 `npm pack` 产物**逐字节一致**；已核对包内 10 个文件、通用二进制、`cordis.patch.yml` 与 `client.js` 的 id 均为 `dsh-notifications`。
  - GitHub：`haotian-lu-prog/dsh-notifications`（public，已加 `dsh-plugin` 等 topics）；Release `v1.0.0` 附带 asset `dsh-notifications-1.0.0.tgz`（`https://github.com/haotian-lu-prog/dsh-notifications/releases/download/v1.0.0/dsh-notifications-1.0.0.tgz`）。
  - CI：仓库 4 次 workflow 全部 success（release→publish 一次，push→conventions 三次）。
- dsh market 投稿：已确认投稿方式是往 `awesome-dsh-plugin/awesome-dsh-plugin` 的 `data/plugins/<owner>__<repo>.yml` **加一个文件**（不是编辑 README，README 由脚本生成），分类 `notify`；**CI 要求仓库创建满 1 天**，本仓库建于 2026-09-29 18:21 (+09:00)，故 PR 已排期到 2026-09-30 18:30。
  - 投稿内容已用注册表自己的脚本**干跑验证通过**（/tmp/awesome 浅克隆）：`slugFor(url)` == 文件名；`readEntries()` 解析成功（4383 条，英中齐全）；生成器把它排进 `### Notifications & Integrations`；`node --test scripts/added-dates.test.mjs scripts/capabilities.test.mjs scripts/adopt-discussions.test.mjs` 18/18 通过；`build-site.mjs` 仅因浅克隆 + 条目未提交而报 `no added-date derivable`（真实 PR 有完整历史）。
  - 提交形态：**只加 yml**，不提交生成出来的两个 README（官方接受 yml-only，合并后由 sync-readme 在 main 上重新生成）。
  - **PR 已提交**（2026-09-30 18:30 +09:00）：[awesome-dsh-plugin#6220](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6220) —— head `haotian-lu-prog:add-dsh-notifications`，base `main`，diff **+6/-0、1 个文件**（仅 `data/plugins/haotian-lu-prog__dsh-notifications.yml`），`mergeable: MERGEABLE`。
    - 分支 2026-09-29 即已推好（fork 当时与上游 main 同步在 `4c4167f`，提交 `a4cceb2`）；PR 创建时上游 main 已前进到 `c18ba4a`。三点 diff 仍只有新增文件，故未强制 rebase（也避免动另一个会话正在使用的 `/tmp/awesome` 克隆）。
    - 时间闸门已过：注册表 `check-submission.mjs` 的 `MIN_AGE_DAYS = 1`，仓库建于 2026-09-29T09:21:12Z，PR 创建时正好 24 小时。

## 下一步

- [x] 给 GitHub 仓库加 `dsh-plugin` topic
- [x] 在隔离 profile 里跑 DSH `0.2.0-rc.1` 端到端启动验证（见 `docs/evidence/`）
- [x] 发布 npm `dsh-notifications@1.0.0`
- [x] 建 `v1.0.0` GitHub Release 并上传 tarball asset
- [x] 建仓满 24 小时后，提交 `data/plugins/haotian-lu-prog__dsh-notifications.yml` 并开 PR（[#6220](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6220)，2026-09-30 18:30）

## 未决问题

- 上游是否愿意接受一个"面向 0.2.0-rc.1 的兼容性 PR"？本 fork 先走独立发布；若上游愿意接收 peer 放宽，可以回头提 PR 减少生态分叉。
- 版本线起点：fork 自 `1.0.0` 起算（npm 上 `dsh-notifications` 这个名字曾被他人发过 `0.5.0` 后撤回，故避开 0.5.x）。
