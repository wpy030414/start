# 起始页（Start Page）—— MVP 与设计规范

本文档是给 AI agent 与协作者的权威说明：定义项目的 **MVP 范围**，以及每个功能的 **设计规范**与**关键实现约束**。

---

## 项目概述

一个部署在 GitHub Pages（`start.xrl.im`）上的 React 单页浏览器起始页。整体风格模仿原生 macOS Liquid Glass 悬浮层：顶部一个居中的磨砂玻璃搜索框，底部一排玻璃质感快捷链接图标，以及用户自定义的图片 / 视频背景。

- **Vite 8**（Rolldown 内核）+ **React 19** + **TypeScript**，无外部状态管理库。
- **vite-plugin-pwa** 2.0 生成 Service Worker（`sw.js`），`navigateFallback` + `cleanupOutdatedCaches`。
- 构建产物 `dist/` → GitHub Actions 自动部署到 GitHub Pages。
- `public/worker.js` 是旧 SW 墓碑（自注销，用于迁移期驱逐旧 SW）。

---

## 文件结构

```
start/
├── index.html              # Vite 入口（head meta + <div id="root">）
├── vite.config.ts          # Vite + React + VitePWA 配置
├── playwright.config.ts    # E2E（chromium + webkit，webServer builder+preview）
├── tsconfig.json           # src 类型检查（bundler resolution，react-jsx）
├── tsconfig.node.json      # vite.config / playwright.config / e2e 类型检查
├── package.json
├── pnpm-lock.yaml
├── .gitignore
├── AGENTS.md
├── .github/workflows/
│   └── deploy.yml          # push prod → build → deploy-pages
├── public/
│   ├── CNAME               # start.xrl.im
│   ├── worker.js           # 旧 SW 墓碑
│   └── icons/              # PWA manifest 图标（192/512/maskable）
├── e2e/                    # Playwright：8 个 spec 覆盖全部 MVP
└── src/
    ├── main.tsx            # createRoot + migrateLegacySW
    ├── App.tsx             # 根组件：组合 hooks/组件，全局键盘，SettingsBody
    ├── sw-migrate.ts       # 注销 /worker.js 并清理旧缓存/IDB
    ├── styles/             # 全局 CSS 按功能模块拆分（选择器零改动）
    │   ├── base.css        # 变量 + reset + html,body
    │   ├── background.css  # #bg-layer + 暗角伪元素 + default-bg/default-dot
    │   ├── search.css      # top-third + search-shell/card + engine-btn + 移动端
    │   ├── shortcuts.css   # modal + shortcut-item + proxy + showcase
    │   ├── buttons.css     # help-btn/settings-btn + 垃圾桶/drop-target 变体
    │   └── popovers.css    # help-popover + settings/toggle/slider/reset
    ├── lib/
    │   ├── constants.ts    # engines 表、localStorage key、MAX_*、周期上下限
    │   ├── bg-hash.ts      # FNV-1a base32 文件哈希
    │   ├── db.ts           # IndexedDB 背景存储（Safari 序列化 + 事务纪律）
    │   ├── media-url.ts    # blob URL probe + data: URL 回退（module-level 强引用）
    │   └── proxy.ts        # 跨域抓取（p.xrl.im/?url=）、favicon 解析、hostname
    ├── hooks/
    │   ├── useSearchHistory.ts    # 非受控 input + ↑/↓/Esc 翻阅
    │   ├── useBackgroundStore.ts  # order/files/hash/index 内存 + IDB 持久化
    │   ├── useBackgroundMedia.ts  # crossfade 层栈（BgLayer 声明式 + BgMedia 命令式 reveal）
    │   ├── useBgCycle.ts          # effect 依赖驱动排程（图片 setTimeout / 视频 ended）
    │   ├── useBgGesture.ts        # 空白 5 连点 500ms 窗口 + closest 排除区
    │   ├── useShortcuts.ts        # localStorage 增删 + 代理抓取元数据
    │   ├── useShortcutDrag.ts     # HTML5 拖拽状态机（proxy/飞回/click 抑制）
    │   └── usePopover.ts          # 气泡 open + 外点/Esc
    └── components/
        ├── icons.tsx              # 3 引擎 SVG + 齿轮/垃圾桶 SVG
        ├── BackgroundLayer.tsx    # #bg-layer 容器 + DefaultDots + BgMedia 层
        ├── SearchCard.tsx         # 非受控 input + 引擎按钮语义
        ├── ShortcutsShowcase.tsx  # dock 容器（hoverIndex state）
        ├── ShortcutItem.tsx       # 单个 draggable <a>，--tx/--sc pure fn
        ├── ShortcutsModal.tsx     # 添加表单
        ├── ShortcutDragProxy.tsx  # createPortal(document.body) 拖拽代理
        ├── HelpButton.tsx         # 右下 ?（含垃圾桶形态，class 由 prop 驱动）
        ├── HelpPopover.tsx
        ├── SettingsButton.tsx
        └── SettingsPopover.tsx
```

---

## MVP 范围

下列功能构成最小可用产品，任何重构都必须保留它们的行为：

1. **三引擎搜索**：千问（默认）/ 必应 / 哔哩哔哩。再次点击当前引擎图标发起搜索（留空则进入该引擎首页），点击其他引擎仅切换。默认引擎记忆在 localStorage `default_engine`。
2. **搜索历史**：`↑` / `↓` 浏览（↑ 首按落在最旧一条、连续 ↑ 向新方向）、`Esc` 复位，去重后最多 100 条。存 `search_history`（`{q, engine, time}[]`）。
3. **自定义背景**：快速连续点按空白处 5 次选图 / 视频，立即应用并交叉溶解。
4. **背景历史**：最近 10 个，`←` / `→` 浏览、`Enter` 置顶，持久化在 IndexedDB。
5. **设置气泡（背景循环）**：左下角齿轮，开关「循环播放」「循环类型隔离」，「切换周期」滑块 6-30s；「重置」仅清搜索历史与背景。
6. **快捷链接**：按 `+` 添加（自动抓标题与 favicon），最多 6 个，dock 风格悬停（hoverIndex state 驱动 --tx/--sc），拖拽删除。
7. **帮助气泡**：右下角 `?` 按钮，弹出功能说明，点外 / `Esc` 关闭。
8. **离线可用**：VitePWA `navigateFallback` + workbox precache，等效 stale-while-revalidate。

---

## 关键实现约束

- React 19 + hooks，输入框**非受控**（ref 直写 value）；状态管理全部自定义 hooks，不使用外部库。
- 跨域快捷链接 / favicon 必须通过反代 `https://p.xrl.im/?url=…`。
- IndexedDB 事务中不在相关读写请求之间插入 `await`；需连续操作时，在一个事务内同步收集 keys/values，再为新写入创建新事务。
- **Safari**：从 IndexedDB 取出的 File 调 `URL.createObjectURL` 可能抛出 WebKitBlobResource error 1 → 存 `{name, type, buffer}` 序列化记录、读取时从 ArrayBuffer 重建 File/Blob。blob URL 用临时 img/video 探测（2.5s 超时），失败回退 FileReader data: URL。
- 引擎按钮 / 快捷链接图标统一 `filter: brightness(0) invert(1)` 反白；展示区（`#shortcuts-showcase`）的图标保持原色。
- Public `worker.js` 是墓碑：install → skipWaiting，activate → 清缓存 + `self.registration.unregister()`，与 `sw-migrate.ts` 双保险确保旧 SW 被清退。
- 构建用 `pnpm`，`pnpm typecheck && vite build`；部署文件放在 `public/`，CNAME 随构建产物到 `dist/`。
- Git commit 遵循 Conventional Commits，commit type/scope 用英文，描述用简体中文。