import { useEffect, useRef } from 'react';
import type { BgStoreState } from './useBackgroundStore';
import type { CycleMode } from '../lib/constants';

/**
 * 背景循环调度。档位语义：
 * - '6' / '30'：图片按周期 setTimeout 切换；视频取消循环、等 ended 后切换。
 * - 'off'：不切换；视频恢复无限循环（重复播放）。
 * 图库只剩一项时不切换（视频保持循环）。
 * effect 依赖驱动重排程：手动导航/添加/删除/改档位都会清旧排程、建新排程。
 */
export function useBgCycle({
  stateRef,
  onAdvance,
  getCurrentVideo,
  mode,
}: {
  stateRef: { current: BgStoreState };
  onAdvance: () => void;
  getCurrentVideo: () => HTMLVideoElement | null;
  mode: CycleMode;
}) {
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // 关闭循环 / 单项图库时恢复视频无限循环
  function restoreLoop() {
    const v = getCurrentVideo();
    if (v) v.loop = true;
  }

  useEffect(() => {
    const s = stateRef.current;
    if (mode === 'off' || !s.currentHash || s.order.length < 2) {
      restoreLoop();
      return;
    }

    const v = getCurrentVideo();
    if (v) {
      v.loop = false;
      const onEnded = () => {
        if (modeRef.current === 'off') return;
        onAdvance();
      };
      v.addEventListener('ended', onEnded);
      return () => v.removeEventListener('ended', onEnded);
    }

    const t = setTimeout(
      () => {
        if (modeRef.current === 'off') return;
        onAdvance();
      },
      Number(mode) * 1000,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateRef.current.currentHash, stateRef.current.currentIndex, stateRef.current.order.length, mode]);

  return { restoreLoop };
}
