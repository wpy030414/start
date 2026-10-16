# DECISIONS

## ADR-1：React 19 + Vite 8，零外部状态管理 / 路由库

- **日期**：2025 Q4（项目启动）
- **状态**：已采纳
- **背景**：项目需要浏览器起始页——一个极简 SPA，功能边界小且固定（搜索 + 快捷链接 + 背景）。引入 Redux / Zustand / React Router 会显著增加 bundle 体积与心智负担。
- **考虑过的方案**：
  1. React + React Router + Zustand（常规全栈 SPA 方案）
  2. 原生 HTML/CSS/JS 单文件（v1 方案）
  3. React 19 + 手写 hooks + Vite 8
- **决策**：方案 3——React 19 + Vite 8，路由和状态管理全部手写自定义 hooks，零外部依赖。
- **为什么选这个**：
  - 项目功能范围小、固定，手写路由（<50 行）和状态管理完全可控。
  - React 19 的 `useRef` + `useState` 已足够覆盖所有状态场景。
  - Vite 8（Rolldown 内核）比 webpack 快一个数量级，HMR 体验好。
- **为什么不选其他**：
  - 方案 1：引入 Router/Zustand 对 2 个页面的 SPA 来说过度设计。
  - 方案 2：v1 已验证单文件方案的痛点——代码膨胀难维护、无类型检查、无热更新、重构风险高。
- **后果**：
  - 路由逻辑完全自主可控，但需手动处理 View Transitions、冷深链等边缘情况。
  - 新加入的开发者需要先理解手写路由 / 状态模式（有 AGENTS.md 文档）。
- **何时重新审视**：页面超过 5 个或出现嵌套路由需求时。

## ADR-2：IndexedDB 序列化 File（Safari 兼容）

- **日期**：2025 Q4
- **状态**：已采纳
- **背景**：背景图片 / 视频需要持久化到浏览器本地。Safari 下，IndexedDB 直接存 File 对象后读取，调用 `URL.createObjectURL` 会抛出 `WebKitBlobResource error 1`。
- **考虑过的方案**：
  1. 直接存 File 到 IndexedDB（Chromium / Firefox 工作正常）
  2. 转为 base64 data: URL 存 localStorage
  3. 存序列化记录 `{name, type, size, lastModified, buffer}`，读时重建 File
- **决策**：方案 3——存序列化记录，读时从 ArrayBuffer 重建 File/Blob。
- **为什么选这个**：
  - 跨浏览器一致行为。
  - ArrayBuffer 比 base64 节省 ~33% 空间。
  - 读取 blob URL 时加 2.5s 探测，失败回退 FileReader data: URL，兼顾性能与可靠性。
- **为什么不选其他**：
  - 方案 1：Safari 直接不可用。
  - 方案 2：base64 比原始二进制大 33%，且大文件（视频）会撑爆 localStorage（5MB 限制）。
- **后果**：
  - 每次读写多一次序列化 / 反序列化开销，但背景文件通常不大（用户不会用 4K 视频做背景）。
  - 事务纪律更严格：必须先收集 ArrayBuffer 再开事务同步写入，不能在事务中 await。
- **何时重新审视**：Safari 修复 WebKitBlobResource 行为后。

## ADR-3：View Transitions 做页面切换动画

- **日期**：2026 Q1
- **状态**：已采纳
- **背景**：首页（/）与设置页（/settings）之间的切换需要平滑过渡。传统方案是 CSS transition / animation 手动管理进出状态。Chromium 已稳定支持 View Transitions API，且起始页目标用户主要使用现代浏览器。
- **考虑过的方案**：
  1. CSS transition 手动管理（fadeIn / fadeOut class toggle）
  2. React Transition Group 或 framer-motion
  3. 原生 View Transitions API（`document.startViewTransition`）
- **决策**：方案 3——原生 View Transitions，`#settings-btn` 与 `.settings-panel` 共享 `view-transition-name: settings-entry` 做容器变形动画；不支持的浏览器降级为瞬时切换。
- **为什么选这个**：
  - 零依赖，API 极其简洁（包裹 `flushSync` 即可）。
  - 容器变形动画（齿轮气泡 ↔ 设置卡片）语义精准，CSS transition 很难等效做到。
  - 降级路径明确：`typeof startViewTransition === 'function'` 检测，不支持则直接 `update()`。
- **为什么不选其他**：
  - 方案 1：容器变形动画需要精确的 `getBoundingClientRect` + FLIP 计算，代码量大且容易出错。
  - 方案 2：引入 framer-motion 增加 bundle 体积，且对两个页面的切换来说过度。
- **后果**：
  - Safari 目前不支持 View Transitions（截至 2026），但降级路径已内置。
  - `view-transition-name` 全局唯一约束需保证（当前仅 settings-entry 一个命名）。
- **何时重新审视**：Safari 支持 View Transitions 后，可移除 CSS transition 降级。

## ADR-4：背景循环从连续范围改为离散档位

- **日期**：2026 Q4
- **状态**：已采纳
- **背景**：早期版本的背景循环使用 6-30s 的连续 slider。实际使用中，用户不会精细区分 7s 和 8s，范围选择反而增加了认知负担。同时，视频的「循环」行为与图片不同（视频应等播放完毕再切）。
- **考虑过的方案**：
  1. 连续整数 slider（6-30s）
  2. 离散档位：6s / 30s / 不循环
- **决策**：方案 2——三个离散档位：图片按周期切换，视频等 ended 再切；「不循环」时视频重复播放。
- **为什么选这个**：
  - 减少选择负担：用户只需决定「快切」「慢切」「不切」。
  - 语义更清晰：6s 适合快速轮播展示，30s 适合沉浸式观看。
  - 视频行为天然与周期概念不兼容——离散档位让视频和图片各走各的调度逻辑。
- **为什么不选其他**：
  - 方案 1：用户不会精细区分秒级差异，slider 的精度是虚假的控制感；视频的「在 X 秒处切」无意义。
- **后果**：
  - 旧版 `bg_cycle` / `bg_cycle_interval` 键需迁移逻辑（`lib/settings.ts` 的 `loadCycleMode`）。
- **何时重新审视**：如果有用户明确需求中间档位（如 15s）。

## ADR-5：引擎槽位预设化，移除 favicon 直连

- **日期**：2026 Q4
- **状态**：已采纳
- **背景**：早期版本允许用户手动为引擎槽位输入 URL，并通过 `chrome://favicon` 或直连获取图标。这带来了两个问题：(1) API 依赖浏览器特权页面，非 Chrome 不可用；(2) 手动配置 URL 门槛高。同时需要更丰富的预设引擎。
- **考虑过的方案**：
  1. 保持自由输入 + favicon 直连
  2. 纯预设列表（不可自定义）
  3. 预设 + 可选自定义（内置 SVG 图标，首字母回退）
- **决策**：方案 3——每个槽位有预设列表（select 下拉选择），同时保留「自定义…」入口；图标全部改用内置 SVG（`ENGINE_ICON_MAP`），自定义引擎用首字母徽章。
- **为什么选这个**：
  - 预设覆盖常见引擎（千问 / ChatGPT / 必应 / 谷歌 / 哔哩哔哩 / 抖音 / YouTube / 维基 / Pixiv），满足绝大多数用户。
  - 内置 SVG 图标零网络请求、跨浏览器一致、加载瞬时。
  - 保留自定义入口作为 escape hatch。
- **为什么不选其他**：
  - 方案 1：favicon 直连依赖浏览器实现差异（Chrome 有 `chrome://favicon`，Firefox/Safari 没有），且网络请求可能失败。
  - 方案 2：失去了灵活性，高级用户会不满。
- **后果**：
  - 下线预设时需保留陈旧 id 的兜底逻辑（否则持久化的 id 会找不到对应引擎）。
  - 图标不再从网络加载，新增引擎需同时添加 SVG 组件。
- **何时重新审视**：需要新增引擎预设时，只需添加 `presets` 项和对应的 SVG 图标。