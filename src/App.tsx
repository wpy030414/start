import { useCallback, useEffect, useRef } from 'react';
import BackgroundLayer from './components/BackgroundLayer';
import SearchCard from './components/SearchCard';
import ShortcutsShowcase from './components/ShortcutsShowcase';
import ShortcutsModal from './components/ShortcutsModal';
import HelpButton from './components/HelpButton';
import HelpPopover from './components/HelpPopover';
import SettingsButton from './components/SettingsButton';
import SettingsPopover from './components/SettingsPopover';
import { usePopover } from './hooks/usePopover';
import { useBackgroundStore } from './hooks/useBackgroundStore';
import { useBackgroundMedia } from './hooks/useBackgroundMedia';
import { useBgCycle } from './hooks/useBgCycle';
import { useBgGesture } from './hooks/useBgGesture';
import { clearBgStore } from './lib/db';
import {
  DEFAULT_CYCLE_INTERVAL, MAX_CYCLE_INTERVAL, MIN_CYCLE_INTERVAL
} from './lib/constants';

import './styles/base.css';
import './styles/background.css';
import './styles/search.css';
import './styles/shortcuts.css';
import './styles/buttons.css';
import './styles/popovers.css';

/* ---------- 设置持久化 ---------- */
function loadBoolSetting(key: string): boolean {
  return localStorage.getItem(key) === '1';
}
function saveBoolSetting(key: string, v: boolean) {
  localStorage.setItem(key, v ? '1' : '0');
}
function loadIntSetting(key: string, fallback: number, min: number, max: number): number {
  const raw = parseInt(localStorage.getItem(key)!, 10);
  return Math.max(min, Math.min(max, Number.isFinite(raw) ? raw : fallback));
}

export default function App() {
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 输入框 ref 暴露给全局键盘（排除目标）
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutTitleRef = useRef<HTMLInputElement | null>(null);
  const shortcutUrlRef = useRef<HTMLInputElement | null>(null);

  const help = usePopover({ buttonRef: helpBtnRef, popoverRef: helpPopoverRef });
  const settings = usePopover({ buttonRef: settingsBtnRef, popoverRef: settingsPopoverRef });

  const bgStore = useBackgroundStore();
  const bgMedia = useBackgroundMedia();
  const { state: bgState, stateRef: bgStateRef, applyFile, promoteCurrent, navigate, setCurrentIndex } = bgStore;
  const { layers, applyBackground, handleSettled, videoRefCb, getCurrentVideo } = bgMedia;

  // 设置状态
  const cycleEnabledRef = useRef(loadBoolSetting('bg_cycle'));
  const cycleIsolatedRef = useRef(loadBoolSetting('bg_cycle_type_isolated'));
  const cycleIntervalRef = useRef(
    loadIntSetting('bg_cycle_interval', DEFAULT_CYCLE_INTERVAL, MIN_CYCLE_INTERVAL, MAX_CYCLE_INTERVAL)
  );

  // 循环调度：advanceBgCycle 计算候选集并环形 +1 切换到下一项
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
    stateRef: bgStateRef,
    onAdvance: advanceBgCycle,
    getCurrentVideo,
    enabled: false, // 启动时传 false，避免 effect 先触发；等 App 挂载后用 ref 驱动
    cycleTypeIsolated: false,
    cycleIntervalSec: cycleIntervalRef.current,
  });

  // 打开一个时关闭另一个（互斥）
  const toggleHelp = () => {
    settings.setOpen(false);
    help.setOpen(!help.open);
  };
  const toggleSettings = () => {
    help.setOpen(false);
    settings.setOpen(!settings.open);
  };

  // 启动加载：有背景则应用，否则显示默认波点
  useEffect(() => {
    if (!bgState.loaded) return;
    if (bgState.currentHash) {
      const file = bgState.files.get(bgState.currentHash);
      if (file) void applyBackground(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgState.loaded]);

  // 选择背景文件：先持久化并更新 order（保证循环排程能看到完整列表），再应用
  const handleBgFile = useCallback(
    async (file: File) => {
      await applyFile(file);
      void applyBackground(file);
    },
    [applyFile, applyBackground]
  );

  const openBgPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  useBgGesture(openBgPicker);

  // 全局键盘
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el === searchInputRef.current ||
        el === shortcutTitleRef.current ||
        el === shortcutUrlRef.current
      )
        return;
      const isModal = document.getElementById('shortcuts-modal')?.classList.contains('open') ?? false;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!bgStateRef.current.loaded || bgStateRef.current.order.length === 0) return;
        const file = navigate(1);
        if (file) void applyBackground(file);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!bgStateRef.current.loaded || bgStateRef.current.order.length === 0) return;
        const file = navigate(-1);
        if (file) void applyBackground(file);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const s = bgStateRef.current;
        if (s.currentIndex <= 0 || s.order.length === 0) return;
        const hash = s.order[s.currentIndex];
        const file = hash ? s.files.get(hash) : null;
        if (!file) return;
        await promoteCurrent();
        void applyBackground(file);
      } else if (e.key === '+' && !isModal) {
        e.preventDefault();
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.classList.add('open');
        const urlInput = document.getElementById('shortcut-url');
        if (urlInput instanceof HTMLInputElement) urlInput.focus();
      } else if (e.key === 'Escape' && isModal) {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.classList.remove('open');
      }
    };
    document.body.addEventListener('keydown', onKey);
    return () => document.body.removeEventListener('keydown', onKey);
  }, [navigate, promoteCurrent, applyBackground, bgStateRef]);

  // 默认背景判定：存储加载完成且当前项无可用文件
  const currentFile = bgState.currentHash ? bgStateRef.current.files.get(bgState.currentHash) : null;
  const isDefault = bgStateRef.current.loaded && !currentFile && layers.length === 0;

  return (
    <>
      <BackgroundLayer
        layers={layers}
        isDefault={isDefault}
        onSettled={handleSettled}
        videoRefCb={videoRefCb}
      />
      <SearchCard ref={searchInputRef} />
      <ShortcutsShowcase />
      <ShortcutsModal titleRef={shortcutTitleRef} urlRef={shortcutUrlRef} />
      <input
        ref={fileInputRef}
        type="file"
        id="file-input"
        accept="image/*,video/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleBgFile(file);
        }}
      />
      <HelpButton rootRef={helpBtnRef} onClick={toggleHelp} />
      <HelpPopover rootRef={helpPopoverRef} open={help.open} />
      <SettingsButton rootRef={settingsBtnRef} onClick={toggleSettings} />
      <SettingsPopover rootRef={settingsPopoverRef} open={settings.open}>
        <SettingsBody
          cycleEnabledRef={cycleEnabledRef}
          cycleIsolatedRef={cycleIsolatedRef}
          cycleIntervalRef={cycleIntervalRef}
          restoreLoop={restoreLoop}
        />
      </SettingsPopover>
    </>
  );
}

/* ---------- 设置子组件（内联，避免 props 透传污染 App） ---------- */

import { useState } from 'react';

function SettingsBody({
  cycleEnabledRef, cycleIsolatedRef, cycleIntervalRef, restoreLoop,
}: {
  cycleEnabledRef: { current: boolean };
  cycleIsolatedRef: { current: boolean };
  cycleIntervalRef: { current: number };
  restoreLoop: () => void;
}) {
  const [cycleEnabled, setCycleEnabled] = useState(cycleEnabledRef.current);
  const [cycleIsolated, setCycleIsolated] = useState(cycleIsolatedRef.current);
  const [cycleInterval, setCycleInterval] = useState(() => String(cycleIntervalRef.current));

  const toggleCycle = () => {
    const next = !cycleEnabled;
    setCycleEnabled(next);
    cycleEnabledRef.current = next;
    saveBoolSetting('bg_cycle', next);
    if (!next) restoreLoop();
  };
  const toggleIsolated = () => {
    const next = !cycleIsolated;
    setCycleIsolated(next);
    cycleIsolatedRef.current = next;
    saveBoolSetting('bg_cycle_type_isolated', next);
  };
  const handleInterval = (v: string) => {
    setCycleInterval(v);
    const n = parseInt(v, 10);
    const clamped = Math.max(MIN_CYCLE_INTERVAL, Math.min(MAX_CYCLE_INTERVAL, Number.isFinite(n) ? n : DEFAULT_CYCLE_INTERVAL));
    cycleIntervalRef.current = clamped;
    localStorage.setItem('bg_cycle_interval', String(clamped));
  };
  const handleReset = () => {
    if (!confirm('确定清除所有搜索历史和背景吗？快捷链接与默认引擎会保留。')) return;
    try { localStorage.removeItem('search_history'); } catch { /* noop */ }
    void clearBgStore().then(() => location.reload());
  };

  return <>
    <div className="setting-row">
      <span className="setting-label">循环播放</span>
      <button type="button" className="toggle" role="switch"
        aria-checked={cycleEnabled} aria-label="循环播放"
        data-setting="cycle" onClick={toggleCycle}>
        <span className="toggle-knob" />
      </button>
    </div>
    <div className="setting-row">
      <span className="setting-label">循环类型隔离</span>
      <button type="button" className="toggle" role="switch"
        aria-checked={cycleIsolated} aria-label="循环类型隔离"
        data-setting="cycleTypeIsolated" onClick={toggleIsolated}>
        <span className="toggle-knob" />
      </button>
    </div>
    <div className="setting-row setting-slider-row">
      <span className="setting-label">
        <span>切换周期</span>
        <span className="setting-value">
          <span>{Number.isFinite(parseInt(cycleInterval)) ? Math.max(MIN_CYCLE_INTERVAL, Math.min(MAX_CYCLE_INTERVAL, parseInt(cycleInterval))) : cycleIntervalRef.current}</span>s
        </span>
      </span>
      <input type="range" id="cycle-interval" className="setting-slider"
        min={MIN_CYCLE_INTERVAL} max={MAX_CYCLE_INTERVAL} step="1"
        value={cycleInterval}
        onChange={e => handleInterval(e.target.value)}
        aria-label="切换周期" />
    </div>
    <button type="button" className="setting-reset" id="setting-reset" onClick={handleReset}>
      重置
    </button>
  </>;
}