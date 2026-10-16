import { createPortal } from 'react-dom';
import type { Shortcut } from '../hooks/useShortcuts';
import { getFaviconUrl, getHostname } from '../lib/proxy';

export default function ShortcutDragProxy({
  item, x, y,
}: {
  item: Shortcut | null;
  x: number;
  y: number;
}) {
  if (!item) return null;

  const imgSrc = item.favicon || getFaviconUrl(item.url);
  const displayTitle = item.title || getHostname(item.url);

  return createPortal(
    <div
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
}