# 起始页（Start Page）—— 项目说明

## 项目概述

一个部署在 GitHub Pages（`start.xrl.im`）上的单文件浏览器起始页。整体风格模仿原生 macOS Liquid Glass 悬浮层：顶部一个居中的磨砂玻璃搜索框，底部一排玻璃质感快捷链接图标，以及用户自定义的图片/视频背景。

- 仅允许单个 HTML 文件（`index.html`），所有 HTML、CSS、JS 写在一起。
- 不使用构建步骤或外部框架。
- 配套根作用域 Service Worker `worker.js` 实现离线缓存。

---

## 文件结构

```
start/
├── CNAME          # start.xrl.im
├── index.html     # 单文件应用（HTML + CSS + JS）
└── worker.js      # Service Worker
```

---

## 视觉风格

- **LiquidGlass**：使用 `backdrop-filter: blur(...) saturate(...)`、半透明径向渐变背景、细白描边、顶部内高光、柔和阴影。
- **配色**：深色底 + 磨砂白色上层 UI。
- **动画**：使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 营造弹性感。
- **背景层**：固定全屏，图片/视频 `object-fit: cover`，并叠加暗角与高光纹理。

---

## 1. 搜索

### 布局
- 搜索框位于视窗上 1/3 处并水平居中。
- 容器宽度为 `min(700px, 94vw)`，胶囊形圆角。
- 搜索框获得焦点时整体轻微上移并放大，hover 与 focus 时触发柔和扫光动画。

### 搜索引擎
- 提供三个引擎：千问（默认）、必应、哔哩哔哩。
- 引擎按钮为圆形 LiquidGlass 按钮，图标使用亮色反色处理。
- 当前选中引擎底部有白色小圆点指示。
- 点击引擎按钮：
  - 若输入框有文字，直接以该引擎搜索；
  - 若输入框为空，则切换默认引擎并聚焦输入框。
- 默认引擎保存在 `localStorage` 的 `homepage_default_engine` 中。

### 搜索历史
- 输入框聚焦后，按 `↑ / ↓` 翻阅历史记录。
- 按 `↑` 从最新一条开始向上浏览；按 `↓` 向下浏览，到底后恢复最初输入内容。
- 按 `Escape` 重置历史索引并失焦。
- 搜索历史保存在 `localStorage` 的 `homepage_search_history` 中，最多保留 100 条。
- 每次搜索时去重后插到最前。

### 中文输入法回车兼容
- 用户常在中文输入法模式下直接输入英文后按 `Enter` 上屏，此时不应触发搜索。
- 实现方式：监听 `input` 与 `compositionend` 事件并记录最后一次输入时间戳。
- 按下 `Enter` 时，若当前时间与最近一次输入事件间隔小于 100ms，则视为输入法上屏行为，直接返回不搜索。
- 只有在输入完成后稍作停顿再按 `Enter`，才会真正发起搜索。

---

## 2. 背景

### 设置背景
- 双击页面空白处（避开搜索框、快捷链接、帮助按钮/气泡、快捷链接添加模态框区域）打开文件选择器。
- 支持图片与视频文件。
- 选中的背景立即应用，并在切换时通过淡入动画展示。

### 持久化
- 背景文件与历史顺序仅保存在 IndexedDB 中，**不使用 localStorage**。
- 数据库名 `homepage_bg`，对象仓库名 `background`。
- 仅保存两类键：
  - `hash -> File`：通过 `bgHash(file)` 生成，哈希依据文件名、大小、类型、最后修改时间。
  - `'order' -> [hash1, hash2, ...]`：历史顺序数组，最新项在最前。
- 历史最多保留最近 5 个文件；超出时从末尾剔除，并从 `bgFiles` 内存映射中删除。
- 加载 IndexedDB 时会同步 `order` 与 `bgFiles`，清理孤立的 hash。

### 背景历史浏览
- 按 `← / →` 在背景历史中切换。
- 当前浏览位置用 `currentBgIndex` 跟踪；`currentBgHash` 始终指向当前展示项。
- 页面加载时：若 `currentBgHash` 为空而 `order` 有内容，自动取 `order[0]` 作为当前背景，并同步 `currentBgIndex`。

### Safari 兼容
- 加载背景时先尝试 `URL.createObjectURL(file)`。
- 通过临时创建 `<img>` 或 `<video>` 探测 blob URL 是否可用。
- 若 Safari 抛出 `WebKitBlobResource` 错误，回退到读取 `file.arrayBuffer()` 生成 `data:` URL。
- 内存中保留强引用 `activeBgHash / activeBgType / activeBgSrc`，并在切换前 `revokeObjectURL` 旧 blob URL。

---

## 3. 快捷链接

### 布局
- 快捷链接陈列在视窗下 1/3 处，水平居中，与搜索框关于中轴对称。
- 容器 `position: fixed`，宽度 `min(560px, 94vw)`，flex 布局、自动换行、居中。
- 每个链接卡片宽 66px，圆角 13px，垂直排列图标与标题。

### 添加
- 在页面任意位置按 `+`（输入框聚焦时除外）弹出模态框。
- 模态框同样采用 LiquidGlass 风格，填写 URL 与可选标题。
- 标题与 favicon 通过 `https://to.ahkdxx.cn/<url>` 代理抓取：
  - 优先解析 HTML 中的 `<title>`。
  - 优先解析 `<link rel="icon">` 等图标链接；相对路径补全为绝对路径后再经代理。
  - 失败时回退到 `https://to.ahkdxx.cn/<origin>/favicon.ico`。
- 最多保存 6 个快捷链接，存在 `localStorage` 的 `homepage_shortcuts` 中。

### Dock 风格悬停动画
- 鼠标悬浮到某一项时：
  - 被悬浮项放大到 1.4 倍；
  - 紧邻邻居放大到 1.2 倍并向两侧轻推；
  - 隔一项的邻居放大到 1.05 倍并轻微外移。
- 位移通过 `--tx` 与 `--sc` CSS 变量动态注入，视觉上真的“撑开”邻居。
- 鼠标离开 dock 区域后，所有项弹性复位。

### 拖拽删除
- 快捷链接支持 HTML5 drag。
- 拖动开始时：
  - 原 item 添加 `dragging-source` 类并透明化，让列表立即“塌陷”；
  - 创建一个固定定位的 `.shortcut-proxy` 克隆节点，复制原 item 的 flex 布局、背景、边框、阴影；
  - 代理节点通过 `translate3d` 实时跟随光标；
  - 右下角帮助按钮立即扩展为红色垃圾桶并显示“拖到这里删除”。
- 拖动到垃圾桶上方时，垃圾桶进一步放大高亮。
- 在垃圾桶上松手则删除该快捷链接并重新渲染。
- 在非垃圾桶区域松手：代理通过 JS 动画飞回原 item 位置并淡出，原 item 恢复显示。
- 拖拽结束后 1 秒内忽略因此产生的 `click` 冒泡，避免误触帮助按钮。

---

## 4. 帮助气泡

- 右下角固定一个 LiquidGlass 风格圆形 `?` 按钮。
- 点击按钮在左上方弹出气泡，介绍：搜索、搜索历史、快捷链接、背景、背景历史。
- 点击气泡外部或按 `Escape` 关闭。
- 气泡带小三角箭头指向按钮，出现时弹性缩放进入。

---

## 5. 离线与性能

- `worker.js` 在根作用域注册（`/worker.js`，`scope: '/'`），从而拦截导航请求。
- 对主文档采用 stale-while-revalidate：
  - 优先立即返回缓存版本；
  - 后台每 24 小时重新验证并更新缓存。
- 同源静态资源首次使用后缓存。
- 离线时回退到已缓存的文档。

---

## 关键实现约束

- 仅单个 HTML 文件，无构建步骤、无外部框架。
- 跨域快捷链接/favicon 必须通过代理 `https://to.ahkdxx.cn/...`。
- IndexedDB 事务中不在相关读写请求之间插入 `await`；需要连续操作时，在一个事务内同步收集 keys/values，再为新写入创建新事务。
- Service Worker 必须根作用域注册，才能拦截所有导航请求。

---

## Safari 已知坑点

- 对从 IndexedDB 取出的 `File` 调用 `URL.createObjectURL` 可能抛出 `WebKitBlobResource error 1`；实现中通过探测 blob URL 并在失败时回退到 `data:` URL 解决。
- IndexedDB 事务在第一个 microtask 边界会自动提交；同一事务中切勿在相关请求之间 `await`。
