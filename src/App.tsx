import { useCallback, useEffect, useRef, useState } from 'react';
import BackgroundLayer from './components/BackgroundLayer';
import SearchCard from './components/SearchCard';
import ShortcutsShowcase from './components/ShortcutsShowcase';
import ShortcutsModal from './components/ShortcutsModal';
import ShortcutDragProxy from './components/ShortcutDragProxy';
import HelpButton from './components/HelpButton';
import HelpPopover from './components/HelpPopover';
import SettingsButton from './components/SettingsButton';
import SettingsPopover from './components/SettingsPopover';
import { usePopover } from './hooks/usePopover';
import { useBackgroundStore } from './hooks/useBackgroundStore';
import { useBackgroundMedia } from './hooks/useBackgroundMedia';
import { useBgCycle } from './hooks/useBgCycle';
import { useBgGesture } from './hooks/useBgGesture';
import { useShortcuts } from './hooks/useShortcuts';
import { useShortcutDrag } from './hooks/useShortcutDrag';
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutTitleRef = useRef<HTMLInputElement | null>(null);
  const shortcutUrlRef = useRef<HTMLInputElement | null>(null);

  const help = usePopover({ buttonRef: helpBtnRef, popoverRef: helpPopoverRef });
  const settings = usePopover({ buttonRef: settingsBtnRef, popoverRef: settingsPopoverRef });

  const bgStore = useBackgroundStore();
  const bgMedia = useBackgroundMedia();
  const { state: bgState, stateRef: bgStateRef, applyFile, promoteCurrent, navigate, setCurrentIndex } = bgStore;
  const { layers, applyBackground, handleSettled, videoRefCb, getCurrentVideo } = bgMedia;

  // 设置状态（ref，由 SettingsBody 驱动）
  const cycleEnabledRef = useRef(loadBoolSetting('bg_cycle'));
  const cycleIsolatedRef = useRef(loadBoolSetting('bg_cycle_type_isolated'));
  const cycleIntervalRef = useRef(
    loadIntSetting('bg_cycle_interval', DEFAULT_CYCLE_INTERVAL, MIN_CYCLE_INTERVAL, MAX_CYCLE_INTERVAL)
  );

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
    enabled: false, cycleTypeIsolated: false, cycleIntervalSec: cycleIntervalRef.current,
  });

  // 快捷链接
  const { shortcuts, addShortcut, removeShortcut } = useShortcuts();
  const [modalOpen, setModalOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dropHover, setDropHover] = useState(false);

  const {
    dragIndex, proxy, handleDragStart, handleDragEnd, handleDocumentDragOver, handleDrop, shouldSuppressClick,
  } = useShortcutDrag({ onRemove: removeShortcut, maxIndex: shortcuts.length - 1 });

  const toggleHelp = () => {
    if (shouldSuppressClick()) return;
    settings.setOpen(false);
    help.setOpen(!help.open);
  };
  const toggleSettings = () => {
    help.setOpen(false);
    settings.setOpen(!settings.open);
  };

  useEffect(() => {
    if (!bgState.loaded) return;
    if (bgState.currentHash) {
      const file = bgState.files.get(bgState.currentHash);
      if (file) void applyBackground(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgState.loaded]);

  const handleBgFile = useCallback(async (file: File) => {
    await applyFile(file);
    void applyBackground(file);
  }, [applyFile, applyBackground]);

  const openBgPicker = useCallback(() => { fileInputRef.current?.click(); }, []);
  useBgGesture(openBgPicker);

  // 全局键盘（用 state 驱动模态开关，而不是 DOM classList）
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      // Esc 关闭模态——即使焦点在 shortcut 输入框内也应生效
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
        if (shortcutTitleRef.current) shortcutTitleRef.current.value = '';
        if (shortcutUrlRef.current) shortcutUrlRef.current.value = '';
        return;
      }
      const el = document.activeElement;
      if (el === searchInputRef.current || el === shortcutTitleRef.current || el === shortcutUrlRef.current) return;
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
      } else if (e.key === '+' && !modalOpen) {
        e.preventDefault();
        setModalOpen(true);
        setTimeout(() => shortcutUrlRef.current?.focus(), 0);
      }
    };
    document.body.addEventListener('keydown', onKey);
    return () => document.body.removeEventListener('keydown', onKey);
  }, [navigate, promoteCurrent, applyBackground, bgStateRef, modalOpen]);

  // document dragover（proxy 跟随光标）
  useEffect(() => {
    if (!dragIndex) return;
    document.addEventListener('dragover', handleDocumentDragOver as EventListener);
    return () => document.removeEventListener('dragover', handleDocumentDragOver as EventListener);
  }, [dragIndex, handleDocumentDragOver]);

  // 垃圾桶 drop target（HelpButton 上的 dragover/dragleave/drop）
  useEffect(() => {
    const btn = helpBtnRef.current;
    if (!btn || dragIndex == null) return;
    const onOver = (e: DragEvent) => { e.preventDefault(); setDropHover(true); };
    const onLeave = () => setDropHover(false);
    const onDp = (e: DragEvent) => {
      e.preventDefault(); setDropHover(false);
      const idx = Number(e.dataTransfer?.getData('text/plain'));
      if (Number.isFinite(idx) && idx >= 0 && idx < shortcuts.length) {
        handleDrop(idx);
        handleDragEnd();
      }
    };
    // 阻止 defer 导致"已清理"问题：直接绑定 btn
    btn.addEventListener('dragover', onOver);
    btn.addEventListener('dragleave', onLeave);
    btn.addEventListener('drop', onDp);
    return () => {
      btn.removeEventListener('dragover', onOver);
      btn.removeEventListener('dragleave', onLeave);
      btn.removeEventListener('drop', onDp);
    };
  }, [dragIndex, shortcuts.length, handleDrop, handleDragEnd]);

  // 拖拽结束时清理所有状态
  useEffect(() => {
    if (dragIndex == null) setDropHover(false);
  }, [dragIndex]);

  const currentFile = bgState.currentHash ? bgStateRef.current.files.get(bgState.currentHash) : null;
  const isDefault = bgStateRef.current.loaded && !currentFile && layers.length === 0;

  return (
    <>
      <BackgroundLayer layers={layers} isDefault={isDefault} onSettled={handleSettled} videoRefCb={videoRefCb} />
      <SearchCard ref={searchInputRef} />
      <ShortcutsShowcase
        shortcuts={shortcuts}
        dragIndex={dragIndex}
        hoverIndex={hoverIndex}
        setHoverIndex={setHoverIndex}
        onDragStart={handleDragStart as any}
      />
      <ShortcutDragProxy item={proxy ? shortcuts[proxy.index] : null} x={proxy?.proxyX ?? 0} y={proxy?.proxyY ?? 0} />
      <ShortcutsModal
        open={modalOpen}
        titleRef={shortcutTitleRef}
        urlRef={shortcutUrlRef}
        onClose={() => {
          setModalOpen(false);
          if (shortcutTitleRef.current) shortcutTitleRef.current.value = '';
          if (shortcutUrlRef.current) shortcutUrlRef.current.value = '';
        }}
        onAdd={addShortcut}
      />
      <input
        ref={fileInputRef} type="file" id="file-input" accept="image/*,video/*" hidden
        onChange={e => { const file = e.target.files?.[0]; if (file) void handleBgFile(file); }}
      />
      <HelpButton
        rootRef={helpBtnRef} onClick={toggleHelp}
        isDragging={dragIndex != null} dropHover={dropHover}
      />
      <HelpPopover rootRef={helpPopoverRef} open={help.open} />
      <SettingsButton rootRef={settingsBtnRef} onClick={toggleSettings} />
      <SettingsPopover rootRef={settingsPopoverRef} open={settings.open}>
        <SettingsBody
          cycleEnabledRef={cycleEnabledRef} cycleIsolatedRef={cycleIsolatedRef}
          cycleIntervalRef={cycleIntervalRef} restoreLoop={restoreLoop}
        />
      </SettingsPopover>
    </>
  );
}

/* ---------- SettingsBody ---------- */

function SettingsBody({
  cycleEnabledRef, cycleIsolatedRef, cycleIntervalRef, restoreLoop,
}: {
  cycleEnabledRef: { current: boolean };
  cycleIsolatedRef: { current: boolean };
  cycleIntervalRef: { current: number };
  restoreLoop: () => void;
}) {
  const [cycleEnabled, setCycleEnabled] = useState(() => cycleEnabledRef.current);
  const [cycleIsolated, setCycleIsolated] = useState(() => cycleIsolatedRef.current);
  const [cycleInterval, setCycleInterval] = useState(() => String(cycleIntervalRef.current));

  const toggleCycle = () => {
    const next = !cycleEnabled;
    setCycleEnabled(next); cycleEnabledRef.current = next;
    saveBoolSetting('bg_cycle', next);
    if (!next) restoreLoop();
  };
  const toggleIsolated = () => {
    const next = !cycleIsolated;
    setCycleIsolated(next); cycleIsolatedRef.current = next;
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
    try { localStorage.removeItem('search_history'); } catch {}
    void clearBgStore().then(() => location.reload());
  };

  return <>
    <div className="setting-row">
      <span className="setting-label">循环播放</span>
      <button type="button" className="toggle" role="switch" aria-checked={cycleEnabled} aria-label="循环播放" data-setting="cycle" onClick={toggleCycle}>
        <span className="toggle-knob" />
      </button>
    </div>
    <div className="setting-row">
      <span className="setting-label">循环类型隔离</span>
      <button type="button" className="toggle" role="switch" aria-checked={cycleIsolated} aria-label="循环类型隔离" data-setting="cycleTypeIsolated" onClick={toggleIsolated}>
        <span className="toggle-knob" />
      </button>
    </div>
    <div className="setting-row setting-slider-row">
      <span className="setting-label">
        <span>切换周期</span>
        <span className="setting-value"><span>{Number.isFinite(parseInt(cycleInterval)) ? Math.max(MIN_CYCLE_INTERVAL, Math.min(MAX_CYCLE_INTERVAL, parseInt(cycleInterval))) : cycleIntervalRef.current}</span>s</span>
      </span>
      <input type="range" id="cycle-interval" className="setting-slider" min={MIN_CYCLE_INTERVAL} max={MAX_CYCLE_INTERVAL} step="1" value={cycleInterval} onChange={e => handleInterval(e.target.value)} aria-label="切换周期" />
    </div>
    <button type="button" className="setting-reset" id="setting-reset" onClick={handleReset}>重置</button>
  </>;
}