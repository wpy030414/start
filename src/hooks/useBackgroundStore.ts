import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_BG_HISTORY } from '../lib/constants';
import { bgHash } from '../lib/bg-hash';
import { loadBgStore, persistBgStore } from '../lib/db';

export interface BgStoreState {
  order: string[];
  files: Map<string, File>;
  currentHash: string | null;
  currentIndex: number;
  loaded: boolean;
}

const INITIAL: BgStoreState = {
  order: [],
  files: new Map(),
  currentHash: null,
  currentIndex: -1,
  loaded: false
};

/**
 * 背景存储域：order/files/currentHash/currentIndex 的加载与变更。
 * 变更先更新内存（stateRef 同步镜像）再异步持久化，保证循环排程能看到完整列表。
 */
export function useBackgroundStore() {
  const [state, setState] = useState<BgStoreState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 初始加载：currentHash 为空而 order 有内容时，自动取 order[0]
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const store = await loadBgStore();
      if (cancelled) return;
      setState(prev => {
        let currentHash = prev.currentHash;
        let currentIndex = prev.currentIndex;
        if (!currentHash && store.order.length) {
          currentHash = store.order[0];
          currentIndex = 0;
        }
        if (currentHash && currentIndex < 0) {
          const idx = store.order.indexOf(currentHash);
          if (idx >= 0) currentIndex = idx;
        }
        return { ...store, currentHash, currentIndex, loaded: true };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 新增背景：置顶、裁剪到上限、立即持久化，并设为当前项。 */
  const applyFile = useCallback(async (file: File): Promise<void> => {
    const hash = bgHash(file);
    const s = stateRef.current;
    const order = s.order.filter(h => h !== hash);
    order.unshift(hash);
    const files = new Map(s.files);
    files.set(hash, file);
    if (order.length > MAX_BG_HISTORY) {
      const removed = order.splice(MAX_BG_HISTORY);
      for (const h of removed) files.delete(h);
    }
    const next: BgStoreState = { ...s, order, files, currentHash: hash, currentIndex: 0 };
    stateRef.current = next;
    setState(next);
    await persistBgStore(order, files);
  }, []);

  /** 置顶当前浏览项（Enter）。 */
  const promoteCurrent = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    const hash = s.order[s.currentIndex];
    if (!hash) return;
    const order = s.order.filter(h => h !== hash);
    order.unshift(hash);
    const next: BgStoreState = { ...s, order, currentHash: hash, currentIndex: 0 };
    stateRef.current = next;
    setState(next);
    await persistBgStore(order, s.files);
  }, []);

  /**
   * 键盘导航：delta=1 向更旧方向（←），delta=-1 向更新方向（→）。
   * 返回目标 File（由调用方渲染），无变化 / 无文件时返回 null。
   */
  const navigate = useCallback((delta: 1 | -1): File | null => {
    const s = stateRef.current;
    if (s.order.length === 0) return null;
    let index = s.currentIndex;
    if (index < 0) index = 0;
    const nextIndex =
      delta === 1 ? Math.min(s.order.length - 1, index + 1) : Math.max(0, index - 1);
    if (nextIndex === index) return null;
    const hash = s.order[nextIndex];
    if (!hash) return null;
    const file = s.files.get(hash) ?? null;
    if (!file) return null;
    const next: BgStoreState = { ...s, currentHash: hash, currentIndex: nextIndex };
    stateRef.current = next;
    setState(next);
    return file;
  }, []);

  /** 循环调度：直接把某下标设为当前项，返回对应 File（可能为 null）。 */
  const setCurrentIndex = useCallback((index: number): File | null => {
    const s = stateRef.current;
    const hash = s.order[index];
    if (!hash) return null;
    const file = s.files.get(hash) ?? null;
    if (!file) return null;
    const next: BgStoreState = { ...s, currentHash: hash, currentIndex: index };
    stateRef.current = next;
    setState(next);
    return file;
  }, []);

  const getFile = useCallback((hash: string | null): File | null => {
    if (!hash) return null;
    return stateRef.current.files.get(hash) ?? null;
  }, []);

  return { state, stateRef, applyFile, promoteCurrent, navigate, setCurrentIndex, getFile };
}
