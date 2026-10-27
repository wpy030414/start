/* 引擎槽位与默认索引的持久化/解析。 */

import { DEFAULT_ENGINE_KEY, ENGINE_SLOTS, ENGINE_SLOTS_KEY, type EngineDef, type EngineSlotEntry } from './constants';

/** 存回 localStorage：空串 id 表示自定义值。 */
export function saveSlotEntries(entries: EngineSlotEntry[]): void {
  localStorage.setItem(ENGINE_SLOTS_KEY, JSON.stringify(entries));
}

/** 从 localStorage 读取并校验，缺失或非法则回退到槽位第一项预设。 */
export function loadSlotEntries(): EngineSlotEntry[] {
  try {
    const raw = localStorage.getItem(ENGINE_SLOTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === ENGINE_SLOTS.length) {
        return arr.map((item: unknown, i: number) => {
          if (!item || typeof item !== 'object') return defaultEntry(i);
          const e = item as Record<string, unknown>;
          if (typeof e.id === 'string' && e.id) {
            const preset = ENGINE_SLOTS[i].presets.find((p) => p.id === e.id);
            // 预设下线（如豆包）：陈旧 id 直接回退到该槽位默认预设。
            // 刻意不走下面的自定义分支——那会把已下线的引擎悄悄留成无图标的「自定义引擎」。
            if (preset)
              return {
                id: preset.id,
                name: preset.name,
                urlTemplate: preset.urlTemplate,
                home: preset.home,
              };
            return defaultEntry(i);
          }
          // 自定义引擎
          if (typeof e.name === 'string' && typeof e.urlTemplate === 'string' && typeof e.home === 'string') {
            return {
              id: '',
              name: e.name as string,
              urlTemplate: e.urlTemplate as string,
              home: e.home as string,
            };
          }
          return defaultEntry(i);
        });
      }
    }
  } catch {
    /* noop */
  }
  return ENGINE_SLOTS.map((_, i) => defaultEntry(i));
}

function defaultEntry(i: number): EngineSlotEntry {
  const p = ENGINE_SLOTS[i].presets[0];
  return { id: p.id, name: p.name, urlTemplate: p.urlTemplate, home: p.home };
}

/** 默认引擎槽位下标（持久化于 default_engine；兼容旧版预设 id → 在当前槽位查找）。 */
export function loadDefaultEngineSlot(entries: EngineSlotEntry[]): number {
  const raw = localStorage.getItem(DEFAULT_ENGINE_KEY);
  if (raw === '0' || raw === '1' || raw === '2') return Number(raw);
  if (raw) {
    const idx = entries.findIndex((e) => e.id === raw);
    if (idx >= 0) return idx;
  }
  return 0;
}

/** 将槽位条目展开为可用引擎定义（预设 id 非空时补足预设值以确保一致性）。 */
export function toEngineDef(entry: EngineSlotEntry): EngineDef {
  if (entry.id) {
    for (const slot of ENGINE_SLOTS) {
      const p = slot.presets.find((p) => p.id === entry.id);
      if (p) return p;
    }
  }
  return { id: entry.id, name: entry.name, urlTemplate: entry.urlTemplate, home: entry.home };
}
