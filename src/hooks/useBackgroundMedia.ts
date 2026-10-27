import { useCallback, useRef, useState } from 'react';
import { bgHash } from '../lib/bg-hash';
import { getActiveBgSrc, resetActiveBg, resolveBgSrc } from '../lib/media-url';

export interface BgLayer {
  key: string; // hash，React key 兼作层身份
  kind: 'image' | 'video';
  src: string;
  prevSrc: string | null; // 本层淡入完成后应 revoke 的旧 src
}

/**
 * 背景 crossfade 层栈：新媒体叠在旧媒体上（opacity 0 → 1 约 2s），
 * 淡入完成（onSettled）后移除更早的层并 revoke 旧 blob URL。
 * 链式语义：每层携带自己的 prevSrc，快速连续切换也能正确清理。
 */
export function useBackgroundMedia() {
  const [layers, setLayers] = useState<BgLayer[]>([]);
  const layersRef = useRef<BgLayer[]>([]);
  layersRef.current = layers;
  const intentRef = useRef<string | null>(null);
  const videoRef = useRef<{ key: string; el: HTMLVideoElement } | null>(null);

  const applyBackground = useCallback(async (file: File): Promise<void> => {
    const hash = bgHash(file);
    intentRef.current = hash;
    // StrictMode / 重复应用护栏：栈顶已是同 hash 则跳过
    const cur = layersRef.current;
    if (cur.length && cur[cur.length - 1].key === hash) return;
    const prevSrc = getActiveBgSrc();
    const url = await resolveBgSrc(file);
    if (intentRef.current !== hash) return; // 已有更新的请求，放弃本次
    if (!url) return;
    const kind = (file.type || '').startsWith('video/') ? 'video' : 'image';
    setLayers((prev) => [...prev, { key: hash, kind, src: url, prevSrc }]);
  }, []);

  const handleSettled = useCallback((key: string) => {
    const prev = layersRef.current;
    const idx = prev.findIndex((l) => l.key === key);
    if (idx < 0) return;
    const layer = prev[idx];
    if (layer.prevSrc && layer.prevSrc !== layer.src && layer.prevSrc.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(layer.prevSrc);
      } catch {
        /* noop */
      }
    }
    setLayers((cur) => {
      const i = cur.findIndex((l) => l.key === key);
      return i < 0 ? cur : cur.slice(i);
    });
  }, []);

  /** BgMedia 的 video ref 上报：key 匹配时才更新/清空，避免层卸载顺序覆盖。 */
  const videoRefCb = useCallback((key: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoRef.current = { key, el };
    } else if (videoRef.current?.key === key) {
      videoRef.current = null;
    }
  }, []);

  /** 当前展示中的视频元素（背景循环调度用），可能为 null（图片或无背景）。 */
  const getCurrentVideo = useCallback(() => videoRef.current?.el ?? null, []);

  /** 清空全部背景层（删至无背景时）：revoke 所有 blob URL 并重置模块 active 状态。 */
  const clearBackground = useCallback(() => {
    intentRef.current = null; // 丢弃在途的 resolve
    for (const l of layersRef.current) {
      for (const u of [l.src, l.prevSrc]) {
        if (u && u.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(u);
          } catch {
            /* noop */
          }
        }
      }
    }
    videoRef.current = null;
    setLayers([]);
    resetActiveBg();
  }, []);

  return { layers, applyBackground, handleSettled, videoRefCb, getCurrentVideo, clearBackground };
}
