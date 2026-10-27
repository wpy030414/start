import { useEffect, useRef, useState } from 'react';
import SearchCard from '../components/SearchCard';
import ShortcutsShowcase from '../components/ShortcutsShowcase';
import ShortcutsModal from '../components/ShortcutsModal';
import ShortcutDragProxy from '../components/ShortcutDragProxy';
import AddShortcutButton from '../components/AddShortcutButton';
import SettingsButton from '../components/SettingsButton';
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

/** 首页：搜索、快捷链接、背景历史键盘导航。随路由挂载/卸载——
 *  全局键盘监听（Esc/←/→/Enter）因此只在首页生效；添加走左上角 + 按钮。 */
export default function HomePage({ bgStateRef, navigateBg, promoteCurrent, applyBackground }: HomePageProps) {
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutTitleRef = useRef<HTMLInputElement | null>(null);
  const shortcutUrlRef = useRef<HTMLInputElement | null>(null);

  // 快捷链接
  const { shortcuts, addShortcut, removeShortcut } = useShortcuts();
  const [modalOpen, setModalOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dropHover, setDropHover] = useState(false);

  const { dragIndex, proxy, proxyRef, handleDragStart, handleDragEnd, handleDocumentDragOver, handleDrop } =
    useShortcutDrag({ onRemove: removeShortcut, maxIndex: shortcuts.length - 1 });

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
      }
    };
    document.body.addEventListener('keydown', onKey);
    return () => document.body.removeEventListener('keydown', onKey);
  }, [navigateBg, promoteCurrent, applyBackground, bgStateRef, modalOpen]);

  // 拖拽期间的全局收尾：dragover 让代理跟随光标，dragend 负责「不管在哪松手都结束」
  useEffect(() => {
    // 注意必须是 == null：dragIndex 为 0（拖第一个快捷链接）时 !dragIndex 也为真，
    // 那样代理会僵在原地不动。
    if (dragIndex == null) return;
    document.addEventListener('dragover', handleDocumentDragOver as EventListener);
    // dragend 是唯一无论松手落在哪里都会触发的信号。只把结束挂在删除落点的 drop 上，
    // 会让「拖到别处松手」永远停在拖拽态：body 留着 is-dragging-shortcut、源项一直透明、
    // 代理钉在页面上、左上角 + 一直是红色垃圾桶 —— 只能刷新恢复。
    document.addEventListener('dragend', handleDragEnd);
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver as EventListener);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, [dragIndex, handleDocumentDragOver, handleDragEnd]);

  // 删除落点：左上角 + 按钮（拖拽期间它已变形成垃圾桶胶囊）
  useEffect(() => {
    const btn = addBtnRef.current;
    if (!btn || dragIndex == null) return;
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      setDropHover(true);
    };
    const onLeave = () => setDropHover(false);
    const onDp = (e: DragEvent) => {
      e.preventDefault();
      setDropHover(false);
      const idx = Number(e.dataTransfer?.getData('text/plain'));
      // 收尾交给随后的 dragend：这里只负责「删哪一个」，避免一次拖拽结束两次
      if (Number.isFinite(idx) && idx >= 0 && idx < shortcuts.length) handleDrop(idx);
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
  }, [dragIndex, shortcuts.length, handleDrop]);

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
      <ShortcutDragProxy
        ref={proxyRef}
        item={proxy ? shortcuts[proxy.index] : null}
        x={proxy?.proxyX ?? 0}
        y={proxy?.proxyY ?? 0}
      />
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
      <AddShortcutButton
        rootRef={addBtnRef}
        onClick={() => setModalOpen(true)}
        isDragging={dragIndex != null}
        dropHover={dropHover}
      />
      <SettingsButton />
    </>
  );
}
