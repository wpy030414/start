import { useEffect, useRef } from 'react';
import type { BgStoreState } from './useBackgroundStore';

/**
 * 背景循环调度：图片按周期切换，视频等 ended 事件后切换。
 * effect 依赖驱动重排程：任何手动导航/添加/置顶/改设置都会改变依赖
 * → 清旧排程、建新排程，天然实现"手动导航重置计时"。
 */
export function useBgCycle({
  stateRef,
  onAdvance,
  getCurrentVideo,
  enabled,
  cycleTypeIsolated,
  cycleIntervalSec,
}: {
  stateRef: { current: BgStoreState };
  onAdvance: () => void;
  getCurrentVideo: () => HTMLVideoElement | null;
  enabled: boolean;
  cycleTypeIsolated: boolean;
  cycleIntervalSec: number;
}) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const isolatedRef = useRef(cycleTypeIsolated);
  isolatedRef.current = cycleTypeIsolated;
  const intervalRef = useRef(cycleIntervalSec);
  intervalRef.current = cycleIntervalSec;

  // 计算可参与循环的下标集合
  function candidates(): number[] {
    const s = stateRef.current;
    if (!s.order.length || s.currentIndex < 0) return [];
    if (!isolatedRef.current) return s.order.map((_, i) => i);
    const cur = s.files.get(s.order[s.currentIndex]);
    const curIsVideo = !!(cur && (cur.type || '').startsWith('video/'));
    const out: number[] = [];
    for (let i = 0; i < s.order.length; i++) {
      const f = s.files.get(s.order[i]);
      const isV = !!(f && (f.type || '').startsWith('video/'));
      if (isV === curIsVideo) out.push(i);
    }
    return out;
  }

  // 关闭循环时恢复视频无限循环
  function restoreLoop() {
    const v = getCurrentVideo();
    if (v) v.loop = true;
  }

  useEffect(() => {
    if (!enabled) return;
    const s = stateRef.current;
    if (!s.currentHash) return;

    const cands = candidates();
    if (cands.length < 2) {
      restoreLoop();
      return;
    }

    const v = getCurrentVideo();
    if (v) {
      v.loop = false;
      const onEnded = () => {
        if (!enabledRef.current) return;
        onAdvance();
      };
      v.addEventListener('ended', onEnded);
      return () => v.removeEventListener('ended', onEnded);
    }

    const t = setTimeout(() => {
      if (!enabledRef.current) return;
      onAdvance();
    }, cycleIntervalSec * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateRef.current.currentHash, stateRef.current.currentIndex, stateRef.current.order.length, enabled, cycleTypeIsolated, cycleIntervalSec]);

  return { restoreLoop };
}