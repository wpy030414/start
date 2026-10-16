/* localStorage 设置项读写。 */

import { BG_CYCLE_MODE_KEY, type CycleMode } from './constants';

/** 循环档位；缺省时按旧版键（bg_cycle/bg_cycle_interval）迁移，默认不循环。 */
export function loadCycleMode(): CycleMode {
  const raw = localStorage.getItem(BG_CYCLE_MODE_KEY);
  if (raw === '6' || raw === '30' || raw === 'off') return raw;
  // 旧版迁移：bg_cycle='1' 视为开启，旧周期 >18s 归入 '30'，否则 '6'
  if (localStorage.getItem('bg_cycle') === '1') {
    const old = parseInt(localStorage.getItem('bg_cycle_interval') || '', 10);
    return Number.isFinite(old) && old > 18 ? '30' : '6';
  }
  return 'off';
}

export function saveCycleMode(mode: CycleMode): void {
  localStorage.setItem(BG_CYCLE_MODE_KEY, mode);
}
