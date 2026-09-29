# AGENTS.md — dsh-notifications

macOS 菜单栏活动指示器插件（DSH bundle），上游 [`linbin-mk/dsh-notify`](https://github.com/linbin-mk/dsh-notify) 的社区分支。

## 运行

- 安装依赖：`npm install`
- 构建原生 helper：`npm run build:native`（需 Xcode CLT，输出 `native/dsh-notifications-menubar` 通用二进制）
- 测试：`npm test`（先建原生 helper，再跑 `node --test`）
- 打包：`npm pack`

## 约定

- 工作区总则见各工具 home 的全局指令（`~/.dsh/AGENTS.md` 等）；本文件只写**本项目特有**的内容。
- 开工先读 `HANDOFF.md`；收工更新它（当前状态、下一步、未决问题）并提交。
- 有取舍的决策追加到 `docs/decisions.md`。
- 这是 fork：改动上游代码时必须保留 `LICENSE` / `NOTICE` 里的原版权与署名。
- **peer 范围必须保留显式预发布分支**（`^0.1.7-rc.2 || ^0.2.0-rc.1`）。node-semver 只在范围里存在与目标版本 `major.minor.patch` 元组相同、且自带预发布标签的比较符时才放行预发布版本；写成 `>=0.1.7-rc.2 <0.2.0` 之类会静默排除所有 harness 预发布构建。
- 包名、`cordis.patch.yml` 的 `id`/`name`、`index.js` 的 `ENTRY_ID`、`client.js` 里 `__ModuleLoader__.load({ id })` 必须四者一致：Harness 按**包名**索引客户端模块表。

## 结构

- `index.js` — Host 半侧：Cordis `Config`、Agent 计数、待处理提问/审批标记、原生 helper 生命周期
- `client.js` — Client 半侧：内置设置面板的「通知」页（`settings.section` 插槽）
- `cordis.patch.yml` — profile patch 入口行
- `native/MenuBar.swift` — AppKit 菜单栏 helper 源码
- `scripts/build-native.sh` — arm64 + x86_64 分别编译后 lipo 合并为通用二进制
- `test/plugin.test.js` — `node --test` 测试套件（含原生 helper 探测）
