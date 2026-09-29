# decisions

## 2026-09-29 · 以 fork 方式支持 DSH 0.2.0-rc.1，而不是申请版本豁免

**背景**：上游 `@linbin-mk/dsh-notify@0.4.0` 的 peer 是 `^0.1.7-rc.2`，在 DSH `0.2.0-rc.1` 上会被版本门禁拒绝（`installation rejected: incompatible`）。DSH 提供的绕行手段是"精确版本豁免"（`dsh plugin allow-version`），但豁免只对"那个包版本 + 那个运行时版本"生效，插件或 DSH 一升级就失效。

**决定**：fork 成 `dsh-notifications`，peer 放宽为 `^0.1.7-rc.2 || ^0.2.0-rc.1`。

**依据**：逐包比对 0.1.7-rc.2 与 0.2.0-rc.1 的 npm 产物，本插件触达的 9 个 `@deepseek-ai/*` 包中只有一个类型再导出发生变化（`dsh-api-remotes/lib/types/client/index.d.ts`），没有任何运行时 API 变动。因此"兼容 0.2.0-rc.1"不需要改代码，只需要修正声明。

**代价**：与上游形成命名分叉。缓解：保留完整 git 历史、`LICENSE`/`NOTICE` 署名，并在 README 里写明与上游的关系。

## 2026-09-29 · peer 范围写成两个显式预发布分支

**决定**：`"^0.1.7-rc.2 || ^0.2.0-rc.1"`，而不是 `">=0.1.7-rc.2 <0.3.0"`。

**原因**：node-semver 只在一个范围里存在「与目标版本 `major.minor.patch` 相同、且自身带预发布标签」的比较符时，才让预发布版本满足该范围。宽范围写法会静默排除 harness 的所有预发布构建，用户 `npm install` 时会撞上 `ERESOLVE`。这一条也是 awesome-dsh-plugin 收录指南明确点名的坑。

## 2026-09-29 · 包名与客户端模块 id 对齐

**决定**：包名、`cordis.patch.yml` 的 `id`/`name`、`ENTRY_ID`、`client.js` 的 `__ModuleLoader__.load({ id })` 全部使用 `dsh-notifications`。

**原因**：Harness 按**包名**索引客户端模块表。上游曾在 0.2.0/0.2.1 用短名注册客户端 bundle，导致浏览器侧整个 GUI 起不来（Host 半侧与菜单栏却正常）。对齐后这类不一致不可能再出现。

## 2026-09-29 · 版本号从 1.0.0 起算

**原因**：npm 上 `dsh-notifications` 这个名字曾被他人在 `0.5.0` 发布后撤回；避开 `0.5.x` 以免撞上 registry 的版本回溯记录。功能上这是上游 0.4.0 的直接延续，与上游版本线脱钩后在 README / HANDOFF 里写明。
