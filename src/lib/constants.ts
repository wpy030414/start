/* 全局常量：引擎预设/槽位、存储 key、上限与循环档位。 */

/* ---------- 搜索引擎 ---------- */

export interface EngineDef {
  id: string;          // 预设 id（稳定标识，持久化只存 id）
  name: string;
  urlTemplate: string; // 搜索 URL 模板，{q} 为关键词占位
  home: string;        // 留空输入时进入的首页
}

/** 以模板构造搜索 URL（{q} 替换为编码后的关键词）。 */
export function searchUrl(def: EngineDef, q: string): string {
  return def.urlTemplate.replace('{q}', encodeURIComponent(q));
}

/** 引擎 favicon：直连目标域名 /favicon.ico，不经代理（配合 no-referrer）。 */
export function faviconUrl(def: EngineDef): string {
  try {
    return new URL('/favicon.ico', def.home).toString();
  } catch {
    return '';
  }
}

/** 内置 SVG 图标的引擎 id（其余预设使用直连 favicon）。 */
export const BUILTIN_ENGINE_ICONS: ReadonlySet<string> = new Set(['qianwen', 'bing', 'bilibili']);

export const ENGINE_PRESETS: EngineDef[] = [
  { id: 'qianwen', name: '千问', urlTemplate: 'https://tongyi.aliyun.com/qianwen/?query={q}', home: 'https://tongyi.aliyun.com/qianwen/' },
  { id: 'bing', name: '必应', urlTemplate: 'https://www.bing.com/search?q={q}', home: 'https://www.bing.com/' },
  { id: 'bilibili', name: '哔哩哔哩', urlTemplate: 'https://search.bilibili.com/all?keyword={q}', home: 'https://www.bilibili.com/' },
  { id: 'google', name: '谷歌', urlTemplate: 'https://www.google.com/search?q={q}', home: 'https://www.google.com/' },
  { id: 'baidu', name: '百度', urlTemplate: 'https://www.baidu.com/s?wd={q}', home: 'https://www.baidu.com/' },
  { id: 'douyin', name: '抖音', urlTemplate: 'https://www.douyin.com/search/{q}', home: 'https://www.douyin.com/' },
  { id: 'x', name: 'X', urlTemplate: 'https://x.com/search?q={q}', home: 'https://x.com/' },
  { id: 'pixiv', name: 'pixiv', urlTemplate: 'https://www.pixiv.net/tags/{q}/artworks', home: 'https://www.pixiv.net/' },
  { id: 'github', name: 'GitHub', urlTemplate: 'https://github.com/search?q={q}', home: 'https://github.com/' },
  { id: 'youtube', name: 'YouTube', urlTemplate: 'https://www.youtube.com/results?search_query={q}', home: 'https://www.youtube.com/' },
  { id: 'wikipedia', name: '维基百科', urlTemplate: 'https://zh.wikipedia.org/w/index.php?search={q}', home: 'https://zh.wikipedia.org/' },
];

/** 默认引擎槽位：前三个预设。 */
export const DEFAULT_ENGINE_SLOTS: EngineDef[] = ENGINE_PRESETS.slice(0, 3);

export const ENGINE_SLOTS_KEY = 'engines';       // 3 个槽位的预设 id 数组
export const DEFAULT_ENGINE_KEY = 'default_engine'; // 槽位下标 '0'|'1'|'2'（兼容旧版预设 id）

/* ---------- 存储 key 与上限 ---------- */

export const HISTORY_KEY = 'search_history';
export const MAX_HISTORY = 100;

export const MAX_BG_HISTORY = 10;
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
