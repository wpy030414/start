/* 全局常量：引擎表、存储 key、上限与周期范围。与原单文件版逐项一致。 */

export type EngineKey = 'qianwen' | 'bing' | 'bilibili';

export interface EngineDef {
  name: string;
  url: (q: string) => string;
  home: string;
}

export const engines: Record<EngineKey, EngineDef> = {
  qianwen: {
    name: '千问',
    url: q => `https://tongyi.aliyun.com/qianwen/?query=${encodeURIComponent(q)}`,
    home: 'https://tongyi.aliyun.com/qianwen/'
  },
  bing: {
    name: '必应',
    url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    home: 'https://www.bing.com/'
  },
  bilibili: {
    name: '哔哩哔哩',
    url: q => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
    home: 'https://www.bilibili.com/'
  }
};

export const ENGINE_ORDER: EngineKey[] = ['qianwen', 'bing', 'bilibili'];

export const DEFAULT_ENGINE_KEY = 'default_engine';
export const HISTORY_KEY = 'search_history';
export const MAX_HISTORY = 100;

export const MAX_BG_HISTORY = 10;
export const SHORTCUTS_KEY = 'shortcuts';
export const MAX_SHORTCUTS = 6;

export const DB_NAME = 'start';
export const STORE_NAME = 'background';
export const ORDER_KEY = 'order';

export const DEFAULT_CYCLE_INTERVAL = 6;
export const MIN_CYCLE_INTERVAL = 6;
export const MAX_CYCLE_INTERVAL = 30;
