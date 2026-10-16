/* 引擎槽位的持久化与解析。 */

import {
  DEFAULT_ENGINE_KEY,
  DEFAULT_ENGINE_SLOTS,
  ENGINE_PRESETS,
  ENGINE_SLOTS_KEY,
  type EngineDef,
} from './constants';

/** 读取 3 个引擎槽位（localStorage 只存预设 id 数组，未知 id 回退该槽默认）。 */
export function loadEngineSlots(): EngineDef[] {
  try {
    const raw = localStorage.getItem(ENGINE_SLOTS_KEY);
    const ids = raw ? JSON.parse(raw) : null;
    if (Array.isArray(ids) && ids.length === 3) {
      return ids.map((id: unknown, i: number) =>
        ENGINE_PRESETS.find(p => p.id === id) ?? DEFAULT_ENGINE_SLOTS[i]
      );
    }
  } catch { /* noop */ }
  return [...DEFAULT_ENGINE_SLOTS];
}

export function saveEngineSlots(slots: EngineDef[]): void {
  localStorage.setItem(ENGINE_SLOTS_KEY, JSON.stringify(slots.map(s => s.id)));
}

/** 默认引擎槽位下标：新格式存 '0'|'1'|'2'；兼容旧版存的预设 id（按当前槽位解析）。 */
export function loadDefaultEngineSlot(slots: EngineDef[]): number {
  const raw = localStorage.getItem(DEFAULT_ENGINE_KEY);
  if (raw === '0' || raw === '1' || raw === '2') return Number(raw);
  if (raw) {
    const idx = slots.findIndex(s => s.id === raw);
    if (idx >= 0) return idx;
  }
  return 0;
}
