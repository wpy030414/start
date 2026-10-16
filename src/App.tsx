import { useCallback, useEffect, useRef, useState } from 'react';
import BackgroundLayer from './components/BackgroundLayer';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import { usePath } from './hooks/useRoute';
import { useBackgroundStore } from './hooks/useBackgroundStore';
import { useBackgroundMedia } from './hooks/useBackgroundMedia';
import { useBgCycle } from './hooks/useBgCycle';
import { loadBoolSetting, loadIntSetting, saveBoolSetting } from './lib/settings';
import {
  BG_CYCLE_INTERVAL_KEY,
  BG_CYCLE_KEY,
  BG_CYCLE_TYPE_ISOLATED_KEY,
  DEFAULT_CYCLE_INTERVAL,
  MAX_CYCLE_INTERVAL,
  MIN_CYCLE_INTERVAL,
} from './lib/constants';

import './styles/base.css';
import './styles/background.css';
import './styles/search.css';
import './styles/shortcuts.css';
import './styles/buttons.css';
import './styles/popovers.css';
import './styles/settings-page.css';

/** 路由壳 + 背景域 owner：BackgroundLayer 常驻（跨路由背景零闪烁），
 *  cycle 设置为 React 状态（/settings 上实时生效）。 */
export default function App() {
  const path = usePath();

  const bgStore = useBackgroundStore();
  const bgMedia = useBackgroundMedia();
  const { state: bgState, stateRef: bgStateRef, applyFile, promoteCurrent, navigate, setCurrentIndex, remove } = bgStore;
  const { layers, applyBackground, handleSettled, videoRefCb, getCurrentVideo, clearBackground } = bgMedia;

  // 背景循环设置：状态为源；ref 镜像供 advanceBgCycle 稳定读取（useBgCycle 的 effect 依赖不含 onAdvance）
  const [cycleEnabled, setCycleEnabled] = useState(() => loadBoolSetting(BG_CYCLE_KEY));
  const [cycleIsolated, setCycleIsolated] = useState(() => loadBoolSetting(BG_CYCLE_TYPE_ISOLATED_KEY));
  const [cycleIntervalSec, setCycleIntervalSec] = useState(() =>
    loadIntSetting(BG_CYCLE_INTERVAL_KEY, DEFAULT_CYCLE_INTERVAL, MIN_CYCLE_INTERVAL, MAX_CYCLE_INTERVAL)
  );
  const cycleIsolatedRef = useRef(cycleIsolated);
  cycleIsolatedRef.current = cycleIsolated;

  // 循环调度
  const advanceBgCycle = useCallback(() => {
    const s = bgStateRef.current;
    if (!s.order.length || s.currentIndex < 0) return;
    const cur = s.files.get(s.order[s.currentIndex]);
    const curIsVideo = !!(cur && (cur.type || '').startsWith('video/'));
    const cands: number[] = [];
    if (!cycleIsolatedRef.current) {
      for (let i = 0; i < s.order.length; i++) cands.push(i);
    } else {
      for (let i = 0; i < s.order.length; i++) {
        const f = s.files.get(s.order[i]);
        if (!!(f && (f.type || '').startsWith('video/')) === curIsVideo) cands.push(i);
      }
    }
    if (cands.length < 2) return;
    const pos = cands.indexOf(s.currentIndex);
    const nextIndex = cands[pos === -1 ? 0 : (pos + 1) % cands.length];
    if (nextIndex === s.currentIndex) return;
    const file = setCurrentIndex(nextIndex);
    if (file) void applyBackground(file);
  }, [bgStateRef, setCurrentIndex, applyBackground]);

  const { restoreLoop } = useBgCycle({
    stateRef: bgStateRef, onAdvance: advanceBgCycle, getCurrentVideo,
    enabled: cycleEnabled, cycleTypeIsolated: cycleIsolated, cycleIntervalSec,
  });

  // 初次加载恢复当前背景
  useEffect(() => {
    if (!bgState.loaded) return;
    if (bgState.currentHash) {
      const file = bgState.files.get(bgState.currentHash);
      if (file) void applyBackground(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgState.loaded]);

  /* ---------- /settings 下放动作 ---------- */

  /** 多选添加：顺序 await（IDB 事务不交叉、crossfade 链式收敛）。 */
  const addBackgroundFiles = useCallback(async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      await applyFile(file);
      await applyBackground(file);
    }
  }, [applyFile, applyBackground]);

  /** 设为当前：置顶（promote 持久化）并应用。 */
  const setCurrentBackground = useCallback((hash: string) => {
    const s = bgStateRef.current;
    const idx = s.order.indexOf(hash);
    if (idx < 0) return;
    const file = setCurrentIndex(idx);
    if (!file) return;
    void promoteCurrent();
    void applyBackground(file);
  }, [bgStateRef, setCurrentIndex, promoteCurrent, applyBackground]);

  /** 删除：命中当前项时切到剩余项，删空则回默认底。 */
  const removeBackground = useCallback((hash: string) => {
    void remove(hash).then(r => {
      if (!r.removedCurrent) return;
      if (r.nextFile) void applyBackground(r.nextFile);
      else clearBackground();
    });
  }, [remove, applyBackground, clearBackground]);

  /* ---------- cycle 设置 setter（持久化 + 受控下放） ---------- */

  const handleCycleEnabled = useCallback((v: boolean) => {
    setCycleEnabled(v);
    saveBoolSetting(BG_CYCLE_KEY, v);
    if (!v) restoreLoop();
  }, [restoreLoop]);

  const handleCycleIsolated = useCallback((v: boolean) => {
    setCycleIsolated(v);
    saveBoolSetting(BG_CYCLE_TYPE_ISOLATED_KEY, v);
  }, []);

  const handleCycleInterval = useCallback((n: number) => {
    const clamped = Math.max(MIN_CYCLE_INTERVAL, Math.min(MAX_CYCLE_INTERVAL, Number.isFinite(n) ? n : DEFAULT_CYCLE_INTERVAL));
    setCycleIntervalSec(clamped);
    localStorage.setItem(BG_CYCLE_INTERVAL_KEY, String(clamped));
  }, []);

  const currentFile = bgState.currentHash ? bgStateRef.current.files.get(bgState.currentHash) : null;
  const isDefault = bgStateRef.current.loaded && !currentFile && layers.length === 0;

  return (
    <>
      <BackgroundLayer layers={layers} isDefault={isDefault} onSettled={handleSettled} videoRefCb={videoRefCb} />
      {path === '/settings' ? (
        <SettingsPage
          bgState={bgState}
          addBackgroundFiles={addBackgroundFiles}
          setCurrentBackground={setCurrentBackground}
          removeBackground={removeBackground}
          cycleEnabled={cycleEnabled}
          cycleIsolated={cycleIsolated}
          cycleIntervalSec={cycleIntervalSec}
          onCycleEnabledChange={handleCycleEnabled}
          onCycleIsolatedChange={handleCycleIsolated}
          onCycleIntervalChange={handleCycleInterval}
        />
      ) : (
        <HomePage
          bgStateRef={bgStateRef}
          navigateBg={navigate}
          promoteCurrent={promoteCurrent}
          applyBackground={applyBackground}
        />
      )}
    </>
  );
}
