import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import type { Shortcut } from '../hooks/useShortcuts';
import { getFaviconUrl, getHostname } from '../lib/proxy';

/**
 * 拖拽代理：createPortal 到 body，跟随光标（transform 由 useShortcutDrag 直写 ref）。
 * 必须把 ref 透传到底层节点 —— `finishDrag` / `handleDocumentDragOver` 都以
 * `proxyRef.current` 是否存在作为「拖拽仍在进行」的判据，ref 没挂上就会一律提前返回
 * （代理不动、松手不删、也没有飞回动画）。
 */
const ShortcutDragProxy = forwardRef<HTMLDivElement, {
  item: Shortcut | null;
  x: number;
  y: number;
}>(function ShortcutDragProxy({ item, x, y }, ref) {
  if (!item) return null;

  const imgSrc = item.favicon || getFaviconUrl(item.url);
  const displayTitle = item.title || getHostname(item.url);

  return createPortal(
    <div
      ref={ref}
      className="shortcut-proxy"
      aria-hidden="true"
      style={{
        width: 66,
        height: 88,
        transform: `translate3d(${x}px, ${y}px, 0) scale(1.14)`,
      }}
    >
      <img className="shortcut-icon" src={imgSrc} alt={displayTitle} />
      <span className="shortcut-title">{displayTitle}</span>
    </div>,
    document.body,
  );
});

export default ShortcutDragProxy;
