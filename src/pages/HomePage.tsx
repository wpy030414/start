import { useEffect, useRef, useState } from 'react';
import SearchCard from '../components/SearchCard';
import ShortcutsShowcase from '../components/ShortcutsShowcase';
import ShortcutsModal from '../components/ShortcutsModal';
import ShortcutDragProxy from '../components/ShortcutDragProxy';
import HelpButton from '../components/HelpButton';
import HelpPopover from '../components/HelpPopover';
import SettingsButton from '../components/SettingsButton';
import { usePopover } from '../hooks/usePopover';
import { useShortcuts } from '../hooks/useShortcuts';
import { useShortcutDrag } from '../hooks/useShortcutDrag';
import type { BgStoreState } from '../hooks/useBackgroundStore';

interface HomePageProps {
  /** 背景域 state 的同步镜像（键盘守卫读 loaded/order/currentIndex）。 */
  bgStateRef: { current: BgStoreState };
  /** 背景历史导航（store.navigate）：delta=1 更旧（←）、-1 更新（→）。 */
  navigateBg: (delta: 1 | -1) => File | null;
  /** 置顶当前浏览项（Enter）。 */
  promoteCurrent: () => Promise<void>;
  /** 应用背景到层栈（crossfade）。 */
  applyBackground: (file: File) => Promise<void>;
}

/** 首页：搜索、快捷链接、帮助气泡、背景历史键盘导航。随路由挂载/卸载——
 *  全局键盘监听（Esc/'+'/←/→/Enter）因此只在首页生效。 */
export default function HomePage({ bgStateRef, navigateBg, promoteCurrent, applyBackground }: HomePageProps) {
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutTitleRef = useRef<HTMLInputElement | null>(null);
  const shortcutUrlRef = useRef<HTMLInputElement | null>(null);

  const help = usePopover({ buttonRef: helpBtnRef, popoverRef: helpPopoverRef });

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
    help.setOpen(!help.open);
  };

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
        const file = navigateBg(1);
        if (file) void applyBackground(file);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!bgStateRef.current.loaded || bgStateRef.current.order.length === 0) return;
        const file = navigateBg(-1);
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
  }, [navigateBg, promoteCurrent, applyBackground, bgStateRef, modalOpen]);

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

  return (
    <>
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
      <HelpButton
        rootRef={helpBtnRef} onClick={toggleHelp}
        isDragging={dragIndex != null} dropHover={dropHover}
      />
      <HelpPopover rootRef={helpPopoverRef} open={help.open} />
      <SettingsButton />
    </>
  );
}
