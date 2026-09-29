# DSH 0.2.0-rc.1 端到端验证记录（2026-09-29）

验证目标：`dsh-notifications@1.0.0` 在**真实 DSH 0.2.0-rc.1 运行时**上能否安装、启动、并注册客户端半侧——不使用任何"精确版本豁免"，也不使用 `allowBuilds` 放行。

环境：隔离 `DSH_HOME`，用 npm 上的 `@deepseek-ai/dsh@0.2.0-rc.1` 以 `pnpm` 装到独立目录，profile 从内建 `web` 模板初始化（`--from-default-profile web`）。全程不触碰桌面 app 正在运行的 `desktop` profile。

## 步骤与结果

1. 建立 profile

   ```sh
   DSH_HOME=<隔离目录> node node_modules/@deepseek-ai/dsh/lib/bin.js \
     --profile web-notifications --from-default-profile web --dump-config
   ```

   组合成功，无报错。

2. 安装本包（走 tarball，不经过 git 源的 `prepare`）

   ```sh
   DSH_HOME=<隔离目录> node node_modules/@deepseek-ai/dsh/lib/bin.js \
     plugin --profile web-notifications add file:./dsh-notifications-1.0.0.tgz
   ```

   ```
   + dsh-notifications file:.../dsh-notifications-1.0.0.tgz
   Packages: +4 | Done in 371ms using pnpm v11.21.0
   ```

   - 没有任何 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`：发布产物自带已编译的原生 helper，不执行构建脚本。
   - 没有任何 `installation rejected ... incompatible`：peer 范围 `^0.1.7-rc.2 || ^0.2.0-rc.1` 覆盖了运行中的 `0.2.0-rc.1`。
   - 无需在 `pnpm-workspace.yaml` 里加 `allowBuilds`。

3. 启动

   ```sh
   DSH_HOME=<隔离目录> node node_modules/@deepseek-ai/dsh/lib/bin.js \
     --profile web-notifications --no-open --port 19412
   ```

   输出只有一行 `dsh web: http://127.0.0.1:19412/?token=<redacted>`（见 `dsh-0.2.0-rc.1-e2e-boot.txt`），**没有任何 warn/error**。

4. Host 半侧确实挂载

   ```
   ps: <pid> .../profiles/web-notifications/node_modules/dsh-notifications/native/dsh-notifications-menubar
   ```

   原生菜单栏 helper 已被插件启动并常驻，说明 `apply()` 完整跑通（Config、Agent 计数、事件订阅、helper 生命周期）。

5. Client 半侧注册正确

   启动页 payload 里：

   ```json
   {"id":"dsh-notifications","url":"plugins/??dsh-notifications/client.js&rev=7053ad34a4d5","rev":"7053ad34a4d5",
    "inject":["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-client-locale",
              "@deepseek-ai/dsh-client-ui-renderer","@deepseek-ai/dsh-client-ui-settings",
              "@deepseek-ai/dsh-api-remotes"]}
   ```

   并且该地址实际返回 `HTTP 200`、11201 字节，内容开头为 `window.__ModuleLoader__.load({ id: 'dsh-notifications', ...`。

   这正是上游 0.2.0/0.2.1 出过事故的地方：客户端模块 id 必须与**包名**一致。上游当时用短名注册导致浏览器侧整个 GUI 起不来；本 fork 两者一致，因此不存在这个失败模式。

结论：包在 DSH `0.2.0-rc.1` 上**装得上、起得来、Host 与 Client 两侧都挂载成功**，且不需要用户做任何授权动作。
