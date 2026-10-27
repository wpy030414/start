# 起始页（Start Page）—— MVP 与设计规范

本文档是给 AI agent 与协作者的权威说明：定义项目的 **MVP 范围**，以及每个功能的 **设计规范**与**关键实现约束**。

---

## 项目概述

一个部署在 GitHub Pages（`start.xrl.im`）上的 React 单页浏览器起始页。整体风格模仿原生 macOS Liquid Glass 悬浮层：顶部一个居中的磨砂玻璃搜索框，底部一排玻璃质感快捷链接图标，以及用户自定义的图片 / 视频背景。

- **Vite 8**（Rolldown 内核，经 **vite-plus / vp** 驱动 dev / build / preview / check）+ **React 19** + **TypeScript**，无外部状态管理库；Node 24 钉在 `.nvmrc`。
- **vite-plugin-pwa** 2.0 生成 Service Worker（`sw.js`），`navigateFallback` + `cleanupOutdatedCaches`。
- 构建产物 `dist/` → GitHub Actions（setup-vp）自动部署到 GitHub Pages；`base` 由仓库变量 `PAGES_BASE_PATH` 注入（本站自定义域 → `/`），代码不推断域名或仓库名。
- `public/worker.js` 是旧 SW 墓碑（自注销，用于迁移期驱逐旧 SW）。
- 玻璃有两套实现：搜索卡 + 引擎按钮 + 两颗角标（左上 `+` / 右上设置）+ 每颗快捷链接由 **`@glass-sdk/liquid-glass`** 绘制真液态玻璃（WebGPU + SVG 折射滤镜），无 WebGPU 时自动回退到手写 `backdrop-filter`；其余玻璃面（面板 / 弹窗 / 拖拽代理 / `+` 变身垃圾桶时）始终是手写实现。

---

## 文件结构

```
start/
├── index.html              # Vite 入口（head meta + %BASE_URL% 图标 + <div id="root">）
├── vite.config.ts          # vp（vite-plus）配置：base/插件/别名 + fmt/lint
├── playwright.config.ts    # E2E（chromium + webkit，webServer = pnpm build && pnpm preview）
├── tsconfig.json           # 全量类型检查（src + vite/playwright 配置 + e2e，bundler resolution，react-jsx）
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml     # allowBuilds：显式拒绝 webgpu/@vgpu 的原生编译脚本（否则 install 退出 1）
├── .nvmrc                  # Node 24：本地 nvm/fnm 与 CI 的 setup-vp 共用这一处
├── .gitignore
├── AGENTS.md
├── .github/workflows/
│   └── deploy.yml          # push main → vp check → vp build → deploy-pages
├── public/
│   ├── CNAME               # start.xrl.im（自定义域）
│   ├── .nojekyll           # 原样拷进 dist/，防止 Jekyll 吞掉 _ 开头的构建产物
│   ├── 404.html            # GH Pages 冷深链兜底：/?spa=<encoded> → 应用还原路径
│   ├── worker.js           # 旧 SW 墓碑（原样托管的纯 JS，不能写 TS 语法）
│   └── icons/              # PWA manifest 图标（192/512/maskable）
├── e2e/                    # Playwright：13 个 spec + helpers 覆盖全部 MVP
│   ├── helpers/bg.ts       # addBgViaSettings / addOneBg（经 /settings 添加背景）
│   └── *.spec.ts
└── src/
    ├── main.tsx            # ?spa= 深链还原 + createRoot + migrateLegacySW
    ├── App.tsx             # 路由壳 + 背景域 owner（store/media/cycle 常驻，BackgroundLayer 全局）
    ├── sw-migrate.ts       # 注销 /worker.js 并清理旧缓存/IDB
    ├── pages/
    │   ├── HomePage.tsx    # 首页：搜索/快捷链接/键盘 ←→Enter+Esc/拖拽删除
    │   └── SettingsPage.tsx# /settings：背景管理网格 + 循环设置 + 标题行「清除所有数据」（BgThumb 自管 URL）
    ├── styles/             # 全局 CSS 按功能模块拆分（选择器零改动）
    │   ├── base.css        # 变量 + reset + html,body
    │   ├── background.css  # #bg-layer + 暗角伪元素 + default-bg/default-dot
    │   ├── search.css      # top-third + search-shell/card + engine-btn + 移动端
    │   ├── shortcuts.css   # modal + shortcut-item + proxy + showcase
    │   ├── buttons.css     # corner-btn（左上 + / 右上齿轮）+ 拖拽态：+ 变红色垃圾桶胶囊
    │   ├── settings-page.css # 设置页布局 + settings/toggle/slider/reset
    │   └── glass.css       # Liquid Glass 场景/材质层 + html[data-glass] 双模式切换
    ├── lib/
    │   ├── constants.ts    # engines 表、localStorage key、MAX_*、周期上下限
    │   ├── settings.ts     # localStorage 设置读写（bool/int 钳制）
    │   ├── bg-hash.ts      # FNV-1a base32 文件哈希
    │   ├── db.ts           # IndexedDB 背景存储（Safari 序列化 + 事务纪律）
    │   ├── media-url.ts    # blob URL probe + data: URL 回退（module-level 强引用）
    │   ├── proxy.ts        # 跨域抓取（p.xrl.im/?url=）、favicon 解析、hostname
    │   └── glass-mode.ts   # html[data-glass] 双模式判定（webgpu ↔ css 回退）
    ├── hooks/
    │   ├── useRoute.ts           # 极简 path 路由（pushState + 手动派发 popstate；切换包 View Transitions，齿轮↔设置卡容器变形）
    │   ├── useSearchHistory.ts   # 非受控 input + ↑/↓ 翻阅 + Enter 提交（输入法守卫）
    │   ├── useBackgroundStore.ts # order/files/hash/index 内存 + IDB 持久化 + remove
    │   ├── useBackgroundMedia.ts # crossfade 层栈（BgLayer 声明式 + BgMedia 命令式 reveal + clearBackground）
    │   ├── useBgCycle.ts         # effect 依赖驱动排程（图片 setTimeout / 视频 ended）
    │   ├── useShortcuts.ts       # localStorage 增删 + 代理抓取元数据
    │   ├── useShortcutDrag.ts    # HTML5 拖拽状态机（proxy/飞回/click 抑制）
    │   └── usePopover.ts         # 弹层 open + 外点/Esc（设置页的引擎下拉在用）
    └── components/
        ├── icons.tsx              # 3 引擎 SVG + 齿轮/垃圾桶 SVG
        ├── BackgroundLayer.tsx    # #bg-layer 容器 + DefaultDots + BgMedia 层
        ├── SearchCard.tsx         # 非受控 input + 引擎按钮语义 + 搜索区玻璃材质层
        ├── GlassBackdrop.tsx      # 玻璃「材质层」（GlassSurface 包装：绝对铺满、不吃事件）
        ├── ShortcutsShowcase.tsx  # dock 容器（hoverIndex state）
        ├── ShortcutItem.tsx       # 单个 draggable <a>，--tx/--sc pure fn
        ├── ShortcutsModal.tsx     # 添加表单
        ├── ShortcutDragProxy.tsx  # createPortal(document.body) 拖拽代理
        ├── AddShortcutButton.tsx  # 左上 +（唯一添加入口）；拖拽时就地变成删除落点
        └── SettingsButton.tsx     # 右上齿轮 <a href="/settings"> + GlassBackdrop，左键拦截为 pushState
```

---

## MVP 范围

下列功能构成最小可用产品，任何重构都必须保留它们的行为：

1. **三引擎搜索**：千问（默认）/ 必应 / 哔哩哔哩。焦点在搜索框时按 `Enter`，或再次点击当前引擎图标，发起搜索（留空则进入该引擎首页）；点击其他引擎仅切换。默认引擎记忆在 localStorage `default_engine`。`Enter` 必须过输入法守卫：组合中、`isComposing`、`keyCode 229`、以及 `compositionend` 后 100ms 内的回车一律不算搜索。
2. **搜索历史**：`↑` / `↓` 浏览（↑ 首按落在**最新**一条、连续 ↑ 向旧推进；↓ 反向回退，已在最新一条时再按 ↓ 退出翻阅并复原原文 —— 队列首尾不相连）、`Esc` 复位，去重后最多 100 条。存 `search_history`（`{q, engine, time}[]`）。
3. **自定义背景**：在设置页 `/settings` 添加图片 / 视频（支持多选），立即应用并交叉溶解；列表支持「设为当前」（置顶）与「删除单个」（删当前自动切到剩余项，删空回默认波点底）。
4. **背景历史**：最近 12 个，首页 `←` / `→` 浏览、`Enter` 置顶，持久化在 IndexedDB。
5. **设置页 `/settings`**：右上角齿轮进入（真链接 + pushState 拦截，Liquid Glass 玻璃面）。含背景管理与「背景循环」档位（6s / 30s / 不循环，实时生效）；标题行右侧「清除所有数据」清除站点全部数据——localStorage、IndexedDB 背景库、Cache Storage 与 SW 注册，随后整页重载（等同全新访客）。
6. **快捷链接**：左上角 `+` 按钮添加（自动抓标题与 favicon），最多 6 个，dock 风格悬停（hoverIndex state 驱动 --tx/--sc）；拖起后 `+` 就地变形成红色垃圾桶胶囊，拖上去松手即删除（`+` 键已下线）。
7. **离线可用**：VitePWA `navigateFallback` + workbox precache，等效 stale-while-revalidate；冷深链 `/settings` 由 `public/404.html` 兜底（`/?spa=<encoded>` → `main.tsx` 渲染前 `replaceState` 还原）。

---

## 关键实现约束

- React 19 + hooks，输入框**非受控**（ref 直写 value）；状态管理全部自定义 hooks，不使用外部库（**路由也不引库**：`useRoute` 手写 pushState + 手动派发 popstate）。
- 页面切换动画用原生 **View Transitions**（`startViewTransition` + `flushSync` 包裹路由更新；`#settings-btn` 与 `.settings-panel` 共用 `view-transition-name: settings-entry` 做容器变形），不支持的浏览器瞬时切换；背景层与设置页禁用 `user-select`（图片/视频默认可被拖拽选中出蓝色高亮）。
- 背景域（store/media/cycle）由 `App.tsx` 常驻持有，`BackgroundLayer` 跨路由不卸载；首页键盘监听随 `HomePage` 挂载/卸载，天然只在首页生效。背景的添加/删除/设为当前只发生在 `/settings`。
- **`Enter` 是双语义键**：焦点在 `#search-input` 内 → `useSearchHistory` 消费为「搜索 / 进引擎首页」；`HomePage` 全局监听在焦点位于搜索框 / 快捷链接输入框时直接返回，其余情况 `Enter` 仍是「背景历史置顶」。
- **输入法组合期间所有按键归 IME**（包括用 `↑`/`↓` 选候选词）：hook 直接返回，不 `preventDefault`、不改写 `value`，否则会冲掉正在组合的文本。
- 冷深链链路：GH Pages 404 → `public/404.html` → `/?spa=<encodeURIComponent(path+search+hash)>` → `main.tsx` `consumeSpaRedirect()` `replaceState` 还原（`URLSearchParams.get` 已解码一次，**勿再 `decodeURIComponent`**；只接受站内绝对路径）。
- 跨域快捷链接 / favicon 必须通过反代 `https://p.xrl.im/?url=…`。
- IndexedDB 事务中不在相关读写请求之间插入 `await`；需连续操作时，在一个事务内同步收集 keys/values，再为新写入创建新事务。
- **Safari**：从 IndexedDB 取出的 File 调 `URL.createObjectURL` 可能抛出 WebKitBlobResource error 1 → 存 `{name, type, buffer}` 序列化记录、读取时从 ArrayBuffer 重建 File/Blob。blob URL 用临时 img/video 探测（2.5s 超时），失败回退 FileReader data: URL。
- 引擎按钮 / 快捷链接图标统一 `filter: brightness(0) invert(1)` 反白；展示区（`#shortcuts-showcase`）的图标保持原色。
- Public `worker.js` 是墓碑：install → skipWaiting，activate → 清缓存 + `self.registration.unregister()`，与 `sw-migrate.ts` 双保险确保旧 SW 被清退。**它被原样托管到站点根，必须是纯 JS**（写成 TS 断言会让浏览器解析即报错，墓碑静默失效）。
- 构建与检查统一走 **vp**：`pnpm dev` / `pnpm build` / `pnpm preview` / `pnpm check`（oxfmt 格式 + oxlint + 类型，CI 同款）。`vite.config.ts` 从 `vite-plus` 导入 `defineConfig`，`base` 来自 `PAGES_BASE_PATH`，本地恒为 `/`。部署文件放在 `public/`，CNAME 与 `.nojekyll` 随构建产物到 `dist/`。`fmt.ignorePatterns` 排除 `**/*.md`（中文表格由人工排版，交给格式化器只会产生无意义 diff）。
- **Liquid Glass（`@glass-sdk/liquid-glass`）铺在固定元素上**：`GlassScene` 包住整页、背景媒体放在 `GlassContent`（它是折射源），材质层 = 搜索卡（`capsule`）+ 三颗引擎按钮（`circle`）+ 左上 `+` / 右上设置（`capsule` / `circle`）+ 每颗快捷链接（`radius={13}`，最多 6 颗），即 6～12 颗 `GlassSurface`。库是把 SVG 折射滤镜挂在**内容层**上再按每个 surface 的矩形取样的，surface 越多、整页内容被反复过滤的次数越多，所以面板 / 弹窗 / 拖拽代理 / `+` 变身垃圾桶时一律不接（它们继续用手写 `backdrop-filter`）；同尺寸的引擎按钮与快捷链接共用同一份缓存的材质图。
- 模式由库的就绪信号决定，写进 `html[data-glass]`（`lib/glass-mode.ts`）：先按 `css` 渲染（首帧绝不空白）→ 场景出现 surface 且 `data-glass-ready="true"` 才切 `webgpu`；`glass:diagnostic` 带 `error`（无 WebGPU 适配器 / 滤镜图超限）则永久回退 `css`。切到 `webgpu` 时 `glass.css` 会清掉这几处元素的 `background`/`border`/`box-shadow`/`backdrop-filter`（否则会在折射层上再糊一层模糊），伪元素的高光与扫光保留。
- 没有 surface 时库也把 `data-glass-ready` 报成 `"true"`（0 个全部就绪），所以升级必须以「场景里有 `.lg-surface`」为前置条件，否则从 `/settings` 直接进首页会撤掉手写玻璃留下一个看不见的搜索框。
- 材质层是**子层**而非父级本身：父级带着 hover/focus 的 transform、dock 磁吸、垃圾桶变形、`view-transition-name` 等交互语义，拆出 `.glass-backdrop`（`position:absolute; inset:0; pointer-events:none`）后原有 DOM 与 CSS 零改动，材质只换「谁来画」。
- `pnpm-workspace.yaml` 的 `allowBuilds` 显式拒绝 `webgpu` / `@vgpu/adapter-node` 的原生编译脚本（只在 Node 侧用原生适配器才需要）；漏了这一步 `pnpm install --frozen-lockfile` 会以 `ERR_PNPM_IGNORED_BUILDS` 退出 1，CI 部署直接断。
- Git commit 遵循 Conventional Commits，commit type/scope 用英文，描述用简体中文。