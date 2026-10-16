# ARCHITECTURE — 起始页（Start Page）

## 系统概述

一个部署在 GitHub Pages 上的 React 19 单页应用，由 Vite 8 构建，vite-plugin-pwa 生成 Service Worker。整体结构分三层：**路由壳（App）→ 页面（HomePage / SettingsPage）→ 领域 hooks + 组件**。

```
浏览器
  │
  ├─ /                          → index.html → main.tsx → App → HomePage
  ├─ /settings                  → (同上)            → App → SettingsPage
  └─ /anything (404)            → GH Pages 404.html → /?spa=<encoded> → main.tsx replaceState
```

```
App（路由壳 + 背景域 owner）
 ├── BackgroundLayer（常驻跨路由，零闪烁）
 │    ├── DefaultDots（无背景时的波点底）
 │    └── BgMedia[]（交叉溶解层栈）
 ├── HomePage（/）
 │    ├── SearchCard（非受控 input + 引擎按钮）
 │    ├── ShortcutsShowcase（dock 容器）
 │    │    └── ShortcutItem[]（draggable <a>）
 │    ├── ShortcutsModal（添加表单）
 │    ├── ShortcutDragProxy（portal 拖拽代理）
 │    ├── HelpButton（右下 ? / 垃圾桶变体）
 │    ├── HelpPopover
 │    └── SettingsButton（左下齿轮 → /settings）
 └── SettingsPage（/settings）
      ├── 背景管理网格（BgThumb × N）
      ├── 循环档位 slider
      ├── 引擎槽位（select 替换）
      └── 「清除所有数据」按钮
```

## 核心模块

| 模块 | 职责 |
|------|------|
| `useRoute` | 极简 path 路由：pushState + 手动派发 popstate，View Transitions 包裹 |
| `useBackgroundStore` | 背景 order/files/hash/index 内存态 + IndexedDB 持久化，提供 add/navigate/promote/remove |
| `useBackgroundMedia` | 交叉溶解层栈：声明式 BgLayer + 命令式 reveal，2.5s blob URL 探测 + data: URL 回退 |
| `useBgCycle` | effect 依赖驱动排程：图片 setTimeout / 视频 ended → onAdvance |
| `useSearchHistory` | 非受控 input ↑/↓/Esc 翻阅 + localStorage 持久化 |
| `useShortcuts` | localStorage 快捷链接增删 + 代理抓取元数据（标题 / favicon） |
| `useShortcutDrag` | HTML5 拖拽状态机：proxy 跟随 / 飞回动画 / click 抑制 |
| `usePopover` | 气泡 open/close + 外部点击 / Esc 关闭 |
| `lib/constants.ts` | 引擎槽位预设表、localStorage key、MAX_* 上限、CycleMode 定义 |
| `lib/db.ts` | IndexedDB 背景存储：序列化 File（Safari 兼容）、事务纪律 |
| `lib/settings.ts` | localStorage 读写（bool/int 钳制、旧版迁移） |
| `lib/bg-hash.ts` | FNV-1a base32 文件哈希 |
| `lib/media-url.ts` | blob URL 探测 + data: URL 回退（module-level 强引用防 GC） |
| `lib/engines.ts` | 引擎槽位持久化（loadSlotEntries / saveSlotEntries） |
| `lib/proxy.ts` | 跨域抓取（p.xrl.im/?url=）、favicon 解析、hostname 提取 |

## 模块关系

```
App
 ├─ usePath() → path
 ├─ useBackgroundStore() → { state, stateRef, applyFile, promoteCurrent, navigate, setCurrentIndex, remove }
 ├─ useBackgroundMedia() → { layers, applyBackground, clearBackground, ... }
 ├─ useBgCycle({ stateRef, onAdvance, getCurrentVideo, mode })
 │    └─ mode ← useState(loadCycleMode) → persist via saveCycleMode
 ├─ 背景动作（addBackgroundFiles / setCurrentBackground / removeBackground）
 │    串联 store 变更 → media 渲染 → cycle 可见
 └─ 路由分支
      ├─ path === '/settings' → SettingsPage（读取 bgState + 动作回调）
      └─ else → HomePage（读取 bgStateRef + navigateBg + promoteCurrent + applyBackground）
```

## 数据流

### 背景添加流程

```
用户选择文件（input[multiple]）
  → SettingsPage.addBackgroundFiles(files)
    → for each file:
        await applyFile(file)       // store: 哈希 → 置顶 → 裁剪到 12 → persistBgStore
        await applyBackground(file) // media: 临时探测 → crossfade → settled → 旧层回收
```

### 背景循环流程

```
useBgCycle effect（依赖 mode / currentIndex / order）
  ├─ mode === 'off': 视频 loop（移除 ended 监听），图片无操作
  ├─ mode === '6' | '30':
  │    ├─ 当前为图片 → setTimeout(周期, onAdvance)
  │    └─ 当前为视频 → 监听 ended → onAdvance
  └─ onAdvance → setCurrentIndex((i+1) % len) → applyBackground
```

### 冷深链流程

```
用户访问 /settings（刷新或直接输入）
  → GH Pages 返回 404.html
    → /?spa=%2Fsettings
      → main.tsx consumeSpaRedirect()
        → URLSearchParams.get('spa') → '/settings'
        → history.replaceState(null, '', '/settings')
        → createRoot → App → usePath() 读取 normalizePath(location.pathname) → '/settings'
```

## 外部系统

| 外部系统 | 用途 |
|----------|------|
| GitHub Pages + GitHub Actions | 静态托管 + CI/CD（push prod → build → deploy） |
| `p.xrl.im` 反代 | 跨域抓取快捷链接标题 / favicon |
| 千问 / 必应 / 哔哩哔哩等搜索引擎 | 搜索跳转目标 |
| VitePWA (workbox) | Service Worker 生成与 precache |
| IndexedDB | 背景文件持久化 |
| localStorage | 搜索历史 / 快捷链接 / 引擎 / 设置项 |

## 重要技术边界

- **React 19 + hooks，无外部状态管理库**：所有状态管理由自定义 hooks 实现。输入框非受控（ref 直写 value）。
- **无外部路由库**：`useRoute` 手写 pushState + 手动派发 popstate；页面切换用原生 View Transitions（`startViewTransition` + `flushSync`）；不支持的浏览器瞬时切换。
- **背景域常驻**：store/media/cycle 由 App 持有，BackgroundLayer 跨路由不卸载。首页键盘监听随 HomePage 挂载 / 卸载。
- **IndexedDB 事务纪律**：不在相关读写请求之间 await 非 store 操作；写入前先收集 ArrayBuffer，再开单事务同步写入。
- **Safari 兼容**：File 存为 `{name, type, buffer}` 序列化记录；blob URL 用临时元素探测（2.5s 超时），失败回退 FileReader data: URL。
- **Service Worker**：`public/worker.js` 是墓碑（自注销），`sw-migrate.ts` 双保险清退旧 SW。当前 SW 由 vite-plugin-pwa 生成。
- **反白图标**：引擎按钮 / 快捷链接图标统一 `filter: brightness(0) invert(1)`；展示区图标保持原色。
- **冷深链**：`URLSearchParams.get` 已解码一次，不再 `decodeURIComponent`；只接受站内绝对路径。