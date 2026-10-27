import type { CSSProperties } from 'react';
import type { Shortcut } from '../hooks/useShortcuts';
import { getFaviconUrl, getHostname } from '../lib/proxy';
import GlassBackdrop from './GlassBackdrop';

const ITEM_W = 66;
const NEAR_PUSH = ITEM_W * 0.5;
const FAR_PUSH = ITEM_W * 0.22;

export function ShortcutItem({
  item,
  index,
  hoverIndex,
  isDraggingSource,
  onDragStart,
  onMouseEnter,
}: {
  item: Shortcut;
  index: number;
  hoverIndex: number | null;
  isDraggingSource: boolean;
  onDragStart: (e: React.DragEvent<HTMLAnchorElement>, index: number) => void;
  onMouseEnter: () => void;
}) {
  const imgSrc = item.favicon || getFaviconUrl(item.url);
  const displayTitle = item.title || getHostname(item.url);

  let tx = 0,
    sc = 1;
  if (hoverIndex !== null && !isDraggingSource && hoverIndex !== index) {
    const d = Math.abs(index - hoverIndex);
    if (d === 1) {
      sc = 1.2;
      tx = (index < hoverIndex ? -1 : 1) * NEAR_PUSH;
    } else if (d === 2) {
      sc = 1.05;
      tx = (index < hoverIndex ? -1 : 1) * FAR_PUSH;
    }
  } else if (hoverIndex === index && !isDraggingSource) {
    sc = 1.4;
  }

  const style: CSSProperties = tx !== 0 || sc !== 1 ? ({ '--tx': `${tx}px`, '--sc': String(sc) } as CSSProperties) : {};

  return (
    <a
      className={'shortcut-item' + (isDraggingSource ? ' dragging-source' : '')}
      style={style}
      {...(tx !== 0 || sc !== 1 ? { 'data-tx': '' } : {})}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      draggable
      data-index={String(index)}
      onDragStart={(e) => onDragStart(e as React.DragEvent<HTMLAnchorElement>, index)}
      onMouseEnter={onMouseEnter}
      onClick={(e) => {
        if (isDraggingSource) e.preventDefault();
      }}
    >
      <GlassBackdrop className="shortcut-item-bg" radius={13} refraction={12} />
      <img
        className="shortcut-icon"
        src={imgSrc}
        alt={displayTitle}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="shortcut-title">{displayTitle}</span>
    </a>
  );
}
