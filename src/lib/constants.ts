/* 全局常量：引擎预设/槽位、存储 key、上限与循环档位。 */

/* ---------- 搜索引擎 ---------- */

export interface EngineDef {
  /** 预设 id；自定义引擎时为空串。 */
  id: string;
  name: string;
  urlTemplate: string; // 搜索 URL 模板，{q} 为关键词占位
  home: string;        // 留空输入时进入该引擎首页
}

/** 以模板构造搜索 URL（{q} 替换为编码后的关键词）。 */
export function searchUrl(def: EngineDef, q: string): string {
  return def.urlTemplate.replace('{q}', encodeURIComponent(q));
}

/** 引擎槽位：每个槽位有预设列表与可选的自定义配置。
 *  持久化时存 { id: 预设id }，或 { name/urlTemplate/home: 自定义值 }。
 *  渲染时首字母回退（不再直连 favicon）；全量改为内置 SVG。
 *  注意：预设 id 会写入 localStorage —— 下线某预设时，须靠 engines.ts 的陈旧 id 回退兜底。 */
export interface EngineSlotDef {
  presets: EngineDef[];
}

export const ENGINE_SLOTS: EngineSlotDef[] = [
  {
    presets: [
      { id: 'qianwen', name: '千问', urlTemplate: 'https://tongyi.aliyun.com/qianwen/?query={q}', home: 'https://tongyi.aliyun.com/qianwen/' },
      { id: 'chatgpt', name: 'ChatGPT', urlTemplate: 'https://chatgpt.com/?q={q}', home: 'https://chatgpt.com/' },
    ],
  },
  {
    presets: [
      { id: 'bing', name: '必应', urlTemplate: 'https://www.bing.com/search?q={q}', home: 'https://www.bing.com/' },
      { id: 'google', name: '谷歌', urlTemplate: 'https://www.google.com/search?q={q}', home: 'https://www.google.com/' },
    ],
  },
  {
    presets: [
      { id: 'bilibili', name: '哔哩哔哩', urlTemplate: 'https://search.bilibili.com/all?keyword={q}', home: 'https://www.bilibili.com/' },
      { id: 'douyin', name: '抖音', urlTemplate: 'https://www.douyin.com/search/{q}', home: 'https://www.douyin.com/' },
      { id: 'youtube', name: 'YouTube', urlTemplate: 'https://www.youtube.com/results?search_query={q}', home: 'https://www.youtube.com/' },
      { id: 'wikipedia', name: '维基百科', urlTemplate: 'https://zh.wikipedia.org/w/index.php?search={q}', home: 'https://zh.wikipedia.org/' },
      { id: 'pixiv', name: 'Pixiv', urlTemplate: 'https://www.pixiv.net/tags/{q}/artworks', home: 'https://www.pixiv.net/' },
    ],
  },
];

/** 持久化簿：每槽一条，id 为空串表示自定义（取 name/urlTemplate/home）。 */
export interface EngineSlotEntry {
  id: string;       // 预设 id，自定义时为空串
  name: string;     // 自定义时有效
  urlTemplate: string;
  home: string;
}

export const ENGINE_SLOTS_KEY = 'engines';
export const DEFAULT_ENGINE_KEY = 'default_engine';

export const MAX_ENGINE_SLOTS = 3;

/* ---------- 存储 key 与上限 ---------- */

export const HISTORY_KEY = 'search_history';
export const MAX_HISTORY = 100;

export const MAX_BG_HISTORY = 12;
export const SHORTCUTS_KEY = 'shortcuts';
export const MAX_SHORTCUTS = 6;

export const DB_NAME = 'start';
export const STORE_NAME = 'background';
export const ORDER_KEY = 'order';

/* ---------- 背景循环 ---------- */

/** 循环档位：'6'/'30' = 图片按周期切换（视频等 ended）；'off' = 不切换，视频重复播放。 */
export type CycleMode = '6' | '30' | 'off';
export const CYCLE_MODES: CycleMode[] = ['6', '30', 'off'];
export const BG_CYCLE_MODE_KEY = 'bg_cycle_mode';