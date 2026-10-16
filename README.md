# 起始页（Start Page）

> 一个部署在 [start.xrl.im](https://start.xrl.im) 的浏览器起始页，整体模仿原生 macOS **Liquid Glass** 悬浮层质感。

## 这是什么？

- **定位**：浏览器新标签页 / 新窗口的起始页——居中磨砂玻璃搜索框 + 底部玻璃质感快捷链接 dock，叠在用户自定义的图片 / 视频背景上。
- **解决的核心问题**：每次打开空白标签看到的是浏览器默认页，而非你自己的起点。起始页让你一眼看到你最常用的搜索引擎、快捷链接和你自己的背景。

## 为什么存在？

- 厌倦了浏览器内置起始页的固定布局与不可定制。
- 想要一个极简但精致的首页：搜索 + 快捷链接 + 轮播背景，不多不少。
- 同时作为 macOS Liquid Glass 设计语言的探索与 React 19 + Vite 8 技术栈的实验场。

## 如何安装和运行？

- **前置要求**：Node.js 22+、pnpm 12+
- **安装步骤**：
  ```bash
  pnpm install
  ```
- **运行 / 启动**：
  ```bash
  pnpm dev        # 开发服务器（Vite HMR）
  pnpm build      # 生产构建 → dist/
  pnpm preview    # 本地预览构建产物（端口 4173）
  pnpm e2e        # Playwright E2E 测试
  pnpm e2e:headed # 有头模式调试
  ```

## 当前状态

- **阶段**：稳定（MVP 已完成，持续迭代）
- **已知限制**：
  - 快捷链接最多 6 个。
  - 背景历史最多保留 12 个。
  - 搜索引擎最多 3 个槽位。
  - Safari 下 IndexedDB 存储的 File 对象需序列化后重建 blob URL。
  - 仅支持现代浏览器（Chromium / Firefox / Safari）。

## 核心技术

- **语言 / 框架 / 关键依赖**：TypeScript + React 19 + Vite 8（Rolldown 内核）+ vite-plugin-pwa + Playwright E2E
- **无外部状态管理库**：状态全部自定义 hooks
- **无外部路由库**：`useRoute` 手写 pushState + 手动派发 popstate
- **背景存储**：IndexedDB（序列化 File 兼容 Safari）
- **部署**：GitHub Actions → GitHub Pages（`start.xrl.im`）
- **离线**：VitePWA navigateFallback + workbox precache