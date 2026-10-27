import type { Shortcut } from '../hooks/useShortcuts';
import { ShortcutItem } from './ShortcutItem';

export default function ShortcutsShowcase({
  shortcuts,
  dragIndex,
  hoverIndex,
  setHoverIndex,
  onDragStart,
}: {
  shortcuts: Shortcut[];
  dragIndex: number | null;
  hoverIndex: number | null;
  setHoverIndex: (v: number | null) => void;
  onDragStart: Parameters<typeof ShortcutItem>[0]['onDragStart'];
}) {
  if (shortcuts.length === 0) return null;

  return (
    <section id="shortcuts-showcase" onMouseLeave={() => setHoverIndex(null)}>
      {shortcuts.map((item, i) => (
        <ShortcutItem
          key={`${item.url}-${i}`}
          item={item}
          index={i}
          hoverIndex={hoverIndex}
          isDraggingSource={dragIndex === i}
          onDragStart={onDragStart}
          onMouseEnter={() => {
            if (dragIndex === null) setHoverIndex(i);
          }}
        />
      ))}
    </section>
  );
}
