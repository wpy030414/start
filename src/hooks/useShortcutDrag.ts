import { useCallback, useRef, useState } from 'react';

interface DragState {
  index: number;
  proxyX: number;
  proxyY: number;
}

/**
 * HTML5 拖拽状态机：dragIndex 驱动视觉（body 类、删除胶囊浮出、源项塌陷），
 * proxy 状态控制 Portal 挂载。
 */
export function useShortcutDrag({ onRemove, maxIndex }: { onRemove: (index: number) => void; maxIndex: number }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [proxy, setProxy] = useState<DragState | null>(null);
  const proxyRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.DragEvent<HTMLAnchorElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setProxy({ index, proxyX: rect.left, proxyY: rect.top });
    setDragIndex(index);
    document.body.classList.add('is-dragging-shortcut');
  }, []);

  // 持续跟踪光标位置（document dragover → ref 直写 transform，不走 state）
  const handleDocumentDragOver = useCallback((e: globalThis.MouseEvent) => {
    if (!proxyRef.current) return;
    proxyRef.current.style.transform = `translate3d(${e.clientX - offsetRef.current.x}px, ${e.clientY - offsetRef.current.y}px, 0) scale(1.14)`;
  }, []);

  // drop 或 dragend 都会结束；flyBack 时播放飞回动画
  const finishDrag = useCallback(
    (flyBack: boolean, dropIndex?: number) => {
      document.body.classList.remove('is-dragging-shortcut');
      const sourceEl = document.querySelector('.shortcut-item.dragging-source');

      if (!proxyRef.current) {
        if (sourceEl) {
          sourceEl.classList.remove('dragging-source');
          (sourceEl as HTMLElement).style.opacity = '';
        }
        setDragIndex(null);
        setProxy(null);
        return;
      }

      if (flyBack) {
        // 飞回动画：260ms 三次缓出
        const proxyEl = proxyRef.current;
        if (sourceEl) {
          const endRect = sourceEl.getBoundingClientRect();
          const startX = proxyEl.getBoundingClientRect().left;
          const startY = proxyEl.getBoundingClientRect().top;
          const startTime = performance.now();
          const duration = 260;
          const animate = (now: number) => {
            const t = Math.min(1, (now - startTime) / duration);
            const e = 1 - Math.pow(1 - t, 3);
            const sx = startX + (endRect.left - startX) * e;
            const sy = startY + (endRect.top - startY) * e;
            proxyEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(${1.14 + (1 - 1.14) * e})`;
            if (t < 1) {
              requestAnimationFrame(animate);
            } else {
              setDragIndex(null);
              setProxy(null);
            }
          };
          requestAnimationFrame(animate);
        }
        if (sourceEl) {
          requestAnimationFrame(() => {
            (sourceEl as HTMLElement).style.opacity = '';
            sourceEl.classList.remove('dragging-source');
          });
        }
        setTimeout(() => {
          setDragIndex(null);
          setProxy(null);
        }, 320);
      } else {
        if (dropIndex !== undefined && dropIndex >= 0 && dropIndex <= maxIndex) {
          onRemove(dropIndex);
        }
        if (sourceEl) {
          (sourceEl as HTMLElement).style.opacity = '';
          sourceEl.classList.remove('dragging-source');
        }
        setDragIndex(null);
        setProxy(null);
      }
    },
    [onRemove, maxIndex],
  );

  const handleDragEnd = useCallback(() => finishDrag(true), [finishDrag]);
  const handleDrop = useCallback((index: number) => finishDrag(false, index), [finishDrag]);

  return {
    dragIndex,
    proxy,
    proxyRef,
    handleDragStart,
    handleDragEnd,
    handleDocumentDragOver,
    handleDrop,
  };
}
