import { useCallback, useEffect, useRef, useState } from 'react';
import { GlassContent, GlassScene } from '@glass-sdk/liquid-glass';
import '@glass-sdk/liquid-glass/styles.css';
import BackgroundLayer from './components/BackgroundLayer';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import { usePath } from './hooks/useRoute';
import { useBackgroundStore } from './hooks/useBackgroundStore';
import { useBackgroundMedia } from './hooks/useBackgroundMedia';
import { useBgCycle } from './hooks/useBgCycle';
import { loadCycleMode, saveCycleMode } from './lib/settings';
import { initGlassMode } from './lib/glass-mode';
import { type CycleMode } from './lib/constants';

import './styles/base.css';
import './styles/background.css';
import './styles/search.css';
import './styles/shortcuts.css';
import './styles/buttons.css';
import './styles/settings-page.css';
import './styles/glass.css';

/** 路由壳 + 背景域 owner：BackgroundLayer 常驻（跨路由背景零闪烁），
 *  cycle 设置为 React 状态（/settings 上实时生效）。
 *
 *  整页包在 GlassScene 里：库靠 SVG 折射滤镜「过滤内容层」来画玻璃，所以背景媒体必须
 *  是场景的 GlassContent（折射源），玻璃只挂在它上面的搜索框（详见 styles/glass.css）。
 *  就绪信号 → html[data-glass] 决定用真玻璃还是回退 CSS 玻璃（见 lib/glass-mode）。 */
export default function App() {
  const path = usePath();
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => initGlassMode(sceneRef.current), []);

  const bgStore = useBackgroundStore();
  const bgMedia = useBackgroundMedia();
  const { state: bgState, stateRef: bgStateRef, applyFile, promoteCurrent, navigate, setCurrentIndex, remove } = bgStore;
  const { layers, applyBackground, handleSettled, videoRefCb, getCurrentVideo, clearBackground } = bgMedia;

  // 背景循环档位：状态为源（'6'|'30'|'off'），/settings 上实时生效
  const [cycleMode, setCycleMode] = useState<CycleMode>(() => loadCycleMode());

  // 循环调度：图库内顺序轮换（图片按周期、视频等 ended 由 useBgCycle 决定）
  const advanceBgCycle = useCallback(() => {
    const s = bgStateRef.current;
    if (s.order.length < 2 || s.currentIndex < 0) return;
    const nextIndex = (s.currentIndex + 1) % s.order.length;
    if (nextIndex === s.currentIndex) return;
    const file = setCurrentIndex(nextIndex);
    if (file) void applyBackground(file);
  }, [bgStateRef, setCurrentIndex, applyBackground]);

  useBgCycle({
    stateRef: bgStateRef, onAdvance: advanceBgCycle, getCurrentVideo, mode: cycleMode,
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

  /* ---------- cycle 档位 setter（持久化 + 受控下放；切到 off 时 useBgCycle 自动恢复视频循环） ---------- */

  const handleCycleMode = useCallback((m: CycleMode) => {
    setCycleMode(m);
    saveCycleMode(m);
  }, []);

  const currentFile = bgState.currentHash ? bgStateRef.current.files.get(bgState.currentHash) : null;
  const isDefault = bgStateRef.current.loaded && !currentFile && layers.length === 0;

  return (
    <GlassScene
      ref={sceneRef}
      className="glass-scene"
      material="regular"
      appearance="light"
    >
      <GlassContent className="glass-content">
        <BackgroundLayer layers={layers} isDefault={isDefault} onSettled={handleSettled} videoRefCb={videoRefCb} />
      </GlassContent>
      {path === '/settings' ? (
        <SettingsPage
          bgState={bgState}
          addBackgroundFiles={addBackgroundFiles}
          setCurrentBackground={setCurrentBackground}
          removeBackground={removeBackground}
          cycleMode={cycleMode}
          onCycleModeChange={handleCycleMode}
        />
      ) : (
        <HomePage
          bgStateRef={bgStateRef}
          navigateBg={navigate}
          promoteCurrent={promoteCurrent}
          applyBackground={applyBackground}
        />
      )}
    </GlassScene>
  );
}
