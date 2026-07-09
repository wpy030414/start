# 起始页（Start Page）—— MVP 与设计规范

本文档是给 AI agent 与协作者的权威说明：定义项目的 **MVP 范围**，以及每个功能的 **设计规范**与**关键实现约束**。修改 `index.html` / `worker.js` 前请先读这份。

---

## 项目概述

一个部署在 GitHub Pages（`start.xrl.im`）上的单文件浏览器起始页。整体风格模仿原生 macOS Liquid Glass 悬浮层：顶部一个居中的磨砂玻璃搜索框，底部一排玻璃质感快捷链接图标，以及用户自定义的图片 / 视频背景。

- 仅允许单个 HTML 文件（`index.html`），所有 HTML、CSS、JS 写在一起，内部按功能模块组织。
- 不使用构建步骤或外部框架。
- 配套根作用域 Service Worker `worker.js` 实现离线缓存。

---

## MVP 范围

下列功能构成最小可用产品，任何重构都必须保留它们的行为：

1. **三引擎搜索**：千问（默认）/ 必应 / 哔哩哔哩。再次点击当前引擎图标发起搜索（留空则进入该引擎首页），点击其他引擎仅切换。默认引擎记忆在 localStorage。
2. **搜索历史**：`↑` / `↓` 浏览、`Esc` 复位，去重后最多 100 条。
3. **自定义背景**：快速连续点按空白处 5 次选图 / 视频，立即应用并交叉溶解。
4. **背景历史**：最近 10 个，`←` / `→` 浏览、`Enter` 置顶，持久化在 IndexedDB。
5. **设置气泡（背景循环）**：左下角图标，开关「循环播放」（图片按设定周期、视频播完切换）与「循环类型隔离」（只切同类型）；「切换周期」滑块可在 6-30 秒间以 1 秒为步进调节；「重置」仅清搜索历史与背景。
6. **快捷链接**：按 `+` 添加（自动抓标题与 favicon），最多 6 个，dock 风格悬停，拖拽删除。
7. **帮助气泡**：右下角 `?` 按钮，弹出功能说明，点外 / `Esc` 关闭。
8. **离线可用**：Service Worker 拦截导航，stale-while-revalidate。

---

## 文件结构

```
start/
├── CNAME          # start.xrl.im
├── index.html     # 单文件应用（HTML + CSS + JS）
└── worker.js      # Service Worker
```

---

## 视觉风格（Liquid Glass）

- **磨砂玻璃**：`backdrop-filter: blur(...) saturate(...)`、半透明径向 / 线性渐变背景、细白描边、顶部内高光、柔和多层阴影。
- **配色**：深色底 + 磨砂白色上层 UI（文字 `rgba(255,255,255,~0.96)`）。
- **动画曲线**：弹性感统一用 `cubic-bezier(0.34, 1.56, 0.64, 1)`；平滑进入用 `cubic-bezier(0.23, 1, 0.32, 1)`。
- **背景层**：`position: fixed` 全屏，图片 / 视频 `object-fit: cover`，仅在真实背景上叠加暗角与高光纹理（`.default-bg` 不叠加，保持干净）。

---

## 1. 搜索

### 布局
- 搜索框位于视窗上 1/3（`33.333vh`）处并水平居中。
- 容器宽度 `min(700px, 94vw)`，胶囊形圆角（`border-radius: 999px`），卡片高度 66px（移动端 56px）。
- `:focus-within` 时整体 `translateY(-2px) scale(1.005)`；hover 轻微上移。
- hover 与 focus 触发柔和扫光动画（`::before` 斜切高光横扫）。

### 搜索引擎
- 三个引擎：千问（默认）、必应、哔哩哔哩。
  - 千问：`https://tongyi.aliyun.com/qianwen/?query=`
  - 必应：`https://www.bing.com/search?q=`
  - 哔哩哔哩：`https://search.bilibili.com/all?keyword=`
- 引擎按钮为 42px（移动端 38px）圆形 LiquidGlass 按钮，图标 `filter: brightness(0) invert(1)` 反白处理。
- 当前选中引擎底部有白色小圆点指示（`.engine-btn.active::after`）。
- 点击引擎按钮：
  - 点击的是**当前激活引擎**：输入框有文字 → 以该引擎搜索；输入框为空 → 跳转到该引擎首页。
  - 点击的是**其他引擎**：仅切换默认引擎（变为激活）并聚焦输入框，不搜索、不跳转。
- 默认引擎保存在 `localStorage` 的 `default_engine` 中。

### 搜索历史
- 输入框聚焦后，按 `↑` / `↓` 翻阅历史记录。
- 按 `↑` 从最新一条开始向上浏览；按 `↓` 向下浏览，到底后恢复最初输入内容。
- 按 `Escape` 重置历史索引并失焦。
- 搜索历史保存在 `localStorage` 的 `search_history` 中，最多保留 100 条。
- 每条记录形如 `{ q, engine, time }`，搜索时按 `q` 去重后插到最前。

---

## 2. 背景

### 设置背景
- 快速连续点按空白处 5 次打开文件选择器（避开搜索框、快捷链接、帮助 / 设置按钮与气泡、快捷链接模态框区域）；相邻两次点按间隔需 ≤ 500ms，超过则重新计数。双击极易误触，故采用 5 次连点作为门槛。
- `accept="image/*,video/*"`，支持图片与视频。
- 选中的背景立即应用；切换时新旧背景**交叉溶解**（新媒体 `position:absolute` 叠在旧媒体上，透明度 `0 → 1` 约 2s，淡入完成后才移除旧媒体并 `revokeObjectURL` 旧 blob，全程不出现黑底；另设 800ms 兜底 reveal、3.5s 兜底 cleanup）。

### 持久化
- 背景文件与历史顺序仅保存在 IndexedDB 中，**不使用 localStorage**。
- 数据库名 `start`（版本 1，单一对象仓库 `background`），对象仓库名 `background`。
- 仅保存两类键：
  - `hash -> { name, type, size, lastModified, buffer }`：通过 `bgHash(file)` 生成，哈希依据 `文件名 | 大小 | 类型 | 最后修改时间`（FNV-1a 风格，base32 输出）。
  - `'order' -> [hash1, hash2, ...]`：历史顺序数组，最新项在最前。
- 历史最多保留最近 10 个文件（`MAX_BG_HISTORY`）；超出时从末尾剔除，并从 `bgFiles` 内存映射中删除。
- 加载 IndexedDB 时会同步 `order` 与 `bgFiles`，清理孤立的 hash。

### 背景历史浏览
- 按 `←` 在历史中向更旧的方向切换（索引 +1），按 `→` 向更新方向切换（索引 −1）。
- 当前浏览位置用 `currentBgIndex` 跟踪；`currentBgHash` 始终指向当前展示项。
- 浏览到非最新项时按 `Enter`，将该背景置顶（`promoteBgFile`，索引归 0）。
- 页面加载时：若 `currentBgHash` 为空而 `order` 有内容，自动取 `order[0]` 作为当前背景，并同步 `currentBgIndex`。

### 默认背景
- 未设置背景时渲染深灰底（`#333`）+ 随机单色（绿 / 粉 / 橙）的密集波点。
- 波点位于边长 48px 的等边三角形顶点上，不随页面宽度变化而改变间距；覆盖范围从顶部到 2/3 vh，越向下越小，到 2/3 vh 处缩为 0 彻底消失。窗口 resize 时防抖重绘。

### Safari 兼容
- 加载背景时先尝试 `URL.createObjectURL(file)`。
- 通过临时创建 `<img>` 或 `<video>` 探测 blob URL 是否可用（`loadedmetadata`/`load` 成功，2.5s 超时判否）。
- 若 Safari 抛出 `WebKitBlobResource` 错误，回退到读取 `file.arrayBuffer()` + `FileReader` 生成 `data:` URL。
- 内存中保留强引用 `activeBgHash / activeBgType / activeBgSrc`，并在切换前 `revokeObjectURL` 旧 blob URL。

### 背景循环播放（设置气泡）
- 左下角固定一个 LiquidGlass 风格齿轮按钮（镜像右下角帮助按钮），弹出与帮助气泡等宽的设置气泡。
- 设置项持久化在 localStorage，默认全部关闭：
  - `bg_cycle`（循环播放）：开启后在已设置的背景间循环切换。
  - `bg_cycle_type_isolated`（循环类型隔离）：开启后只在与当前项同类型（图 / 视频）的背景间切换。
  - `bg_cycle_interval`（切换周期）：图片背景自动切换的间隔，单位秒，范围 6-30，默认 6。
- 切换节奏：图片按 `bg_cycle_interval` 秒切换一次；视频设 `loop=false` 并等待 `ended` 事件后再切换。
- 候选集合由 `cycleCandidateIndices()` 计算：隔离时过滤同类型下标；候选不足 2 个则保持静态（视频恢复 `loop=true`）。
- 每次切换 / 手动 `← / →` / 添加 / 置顶 / 修改周期后都经 `setBackground()` 末尾的 `scheduleBgCycle()` 重新排程，手动导航会重置计时。
- 「重置」按钮：仅清除搜索历史（`search_history`）与 IndexedDB 背景数据（`background` 仓 `clear()`），保留快捷链接、默认引擎与设置项，随后 `location.reload()`；点击时 `confirm()` 二次确认。

---

## 3. 快捷链接

### 布局
- 快捷链接陈列在视窗下 1/3 处（`bottom: calc(33.333vh - 60px)`），水平居中，与搜索框关于中轴对称。
- 容器 `position: fixed`，宽度 `min(560px, 94vw)`，flex 布局、自动换行、居中。
- 每个链接卡片宽 66px，圆角 13px，垂直排列图标与标题。

### 添加
- 在页面任意位置按 `+`（输入框聚焦时除外，且模态框未打开）弹出模态框。
- 模态框同样采用 LiquidGlass 风格，填写 URL 与可选标题。
- 标题与 favicon 通过 `https://to.ahkdxx.cn/<url>` 代理抓取：
  - 优先解析 HTML 中的 `<title>`。
  - 优先解析 `<link rel="icon|shortcut icon|apple-touch-icon">` 等图标链接；相对路径（`//`、`/`、无协议）补全为绝对路径后再经代理。
  - 失败时回退到 `https://to.ahkdxx.cn/<origin>/favicon.ico`。
- 最多保存 6 个快捷链接（`MAX_SHORTCUTS`），存在 `localStorage` 的 `shortcuts` 中。

### Dock 风格悬停动画
- 鼠标悬浮到某一项时：
  - 被悬浮项放大到 1.4 倍；
  - 紧邻邻居放大到 1.2 倍并向两侧推开约 33px；
  - 隔一项的邻居放大到 1.05 倍并轻微外推约 14.5px。
- 位移通过 `--tx` 与 `--sc` CSS 变量动态注入（`.shortcut-item[data-tx]`），视觉上真的「撑开」邻居。
- 鼠标离开整个 dock 区域后，所有项弹性复位；拖拽期间不响应 hover 动画。

### 拖拽删除
- 快捷链接支持 HTML5 drag。
- 拖动开始时：
  - 原 item 添加 `dragging-source` 类并透明化，让列表立即「塌陷」；
  - 创建一个固定定位的 `.shortcut-proxy` 克隆节点（66×88），复制原 item 的外观；
  - 代理节点通过 `translate3d` 实时跟随光标；
  - 右下角帮助按钮立即扩展为红色垃圾桶并显示「拖到这里删除」。
- 拖动到垃圾桶上方时，垃圾桶进一步放大高亮（`drop-target`）。
- 在垃圾桶上松手则删除该快捷链接并重新渲染。
- 在非垃圾桶区域松手：代理通过 JS 动画（260ms 三次缓出）飞回原 item 位置并淡出，原 item 恢复显示。
- 拖拽结束后 1 秒内忽略因此产生的 `click` 冒泡，避免误触帮助按钮。

---

## 4. 帮助气泡

- 右下角固定一个 42px LiquidGlass 风格圆形 `?` 按钮。
- 点击按钮在左上方弹出气泡，介绍：搜索、搜索历史、快捷链接、背景、背景历史。
- 点击气泡外部或按 `Escape` 关闭。
- 气泡出现时弹性缩放 + 上移进入。

---

## 5. 离线与性能

- `worker.js` 在根作用域注册（`/worker.js`，`scope: '/'`），从而拦截导航请求。
- 对主文档采用 stale-while-revalidate：
  - 缓存命中 → 立即返回，后台异步刷新；
  - 缓存缺失 → 取网络，成功则写入缓存，失败则回退缓存。
  - 所有导航统一规范化到缓存键 `/index.html`，避免路径歧义。
- 同源静态资源（GET）首次使用后缓存（stale-while-revalidate）。
- 非 GET 请求与跨域请求一律放行，不缓存。
- Service Worker 必须根作用域注册，才能拦截所有导航请求。

---

## 关键实现约束

- 仅单个 HTML 文件，无构建步骤、无外部框架；内部按功能模块组织。
- 跨域快捷链接 / favicon 必须通过代理 `https://to.ahkdxx.cn/...`。
- IndexedDB 事务中不在相关读写请求之间插入 `await`；需要连续操作时，在一个事务内同步收集 keys / values，再为新写入创建新事务。
- Service Worker 必须根作用域注册，才能拦截所有导航请求。
- 引擎按钮 / 快捷链接图标统一 `filter: brightness(0) invert(1)` 反白；展示区（`#shortcuts-showcase`）的图标保持原色。

---

## Safari 已知坑点

- 对从 IndexedDB 取出的 `File` 调用 `URL.createObjectURL` 可能抛出 `WebKitBlobResource error 1`；实现中通过把 File 序列化为 `{ name, type, buffer }` 存入 IndexedDB，读取时重建 Blob 来避免。
- IndexedDB 事务在第一个 microtask 边界会自动提交；同一事务中切勿在相关请求之间 `await`。
