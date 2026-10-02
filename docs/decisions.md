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

## 2026-10-02 · v2：审批到时必须真的提醒（旧版本"不提醒"的根因）

**现象**：沙箱需要授权（DSH 审批策略切到 ask）时，用户收不到任何提醒。

**根因**——都在"感知"这一层，而不是决策层：

1. Host 半侧**确实**收到了 `approval/request`，但它只把菜单栏状态项的字母改成 `S`：没有声音、没有横幅，人不在机器前就等于没有提醒。
2. Client 半侧完全没有通知逻辑，只渲染设置页（4 个开关）。
3. 参考实现 `omdsh-dev/dsh-notification` 读的是 `uiSession.pendingInteractions`（**复数**）。这个名字在 DSH 0.2.0-rc.1 的运行时里一次都没出现；本版本改用 `uiSession.sessionStatus.getSnapshot().get(sessionId)?.pendingInteraction?.kind` —— 运行时 `ui-session` / `ui-approval` 真正写入的那条路径。照抄参考实现只会得到一个永远静默的 runner。

**决定**：v2 双通道提醒。

- Client 半侧：会话状态驱动的系统通知（审批 / 提问 / 计划审阅 / 完成 / 出错），带关键词规则与后台门控。
- Host 半侧：审批或提问到达的那一刻，让原生 helper 出声（`NSSound`）并把状态项变红闪烁，直到事件被处理——这条通道不依赖浏览器是否开着。

## 2026-10-02 · v2 架构：模块化源码 + 自带零依赖 bundler

**决定**：host 拆成 `lib/host/*`（config / helper / indicator / observe），共享纯逻辑放 `lib/shared/*`（contract / decision，ESM，host 直接 import、client 构建时内联），client 源码拆成 `lib/client/*` 片段，由 `scripts/build-client.mjs` 拼成提交进仓库的 `client.js`。

**原因**：三件事同时要成立——发布产物与仓库逐字节一致、包零运行时依赖、共享的规则与契约只有一份实现。bundler 因此只接受源码实际使用的语法子集，遇到不认识的写法直接报错（多行 `import` 就是第一次运行就撞出来的），并检测重复顶层标识符。

**代价**：client 片段共享一个作用域，靠构建期检查而不是语言机制约束；换来的是不必引入 esbuild/TypeScript 工具链，`client.js` 依然可被 `node --test` 直接 VM 求值测试。

## 2026-10-02 · 设置项留在 profile Config，不放浏览器存储

**决定**：所有开关（包括浏览器通知的）都声明在 host 的 Cordis `Config` 里，client 通过 `configForms` 读写。

**原因**：参考实现把偏好放 localStorage，于是"菜单栏行为"和"通知行为"分居两处，清一次浏览器数据就丢。放进 profile 后设置只有一份事实源，原生 helper 与浏览器半侧永远看到同一份值，`.volatile()` 让它免重启生效。

**代价**：设置页要自己渲染全部控件（不能靠 host 自动生成表单），并且写路径要自己守卫只读/进程内模式。

