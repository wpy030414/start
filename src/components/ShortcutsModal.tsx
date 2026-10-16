import { useEffect } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

export default function ShortcutsModal({
  open,
  titleRef,
  urlRef,
  onClose,
  onAdd,
}: {
  open: boolean;
  titleRef: RefObject<HTMLInputElement | null>;
  urlRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onAdd: (url: string, title: string) => void;
}) {
  const handleAdd = () => {
    const url = urlRef.current?.value ?? '';
    const title = titleRef.current?.value ?? '';
    if (!url.trim()) return;
    onAdd(url, title);
    onClose();
    if (urlRef.current) urlRef.current.value = '';
    if (titleRef.current) titleRef.current.value = '';
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  useEffect(() => {
    if (open) urlRef.current?.focus();
  }, [open, urlRef]);

  return (
    <div id="shortcuts-modal" className={open ? 'open' : ''}>
      <div className="shortcuts-panel">
        <div className="shortcuts-form">
          <input ref={titleRef} type="text" id="shortcut-title" placeholder="标题（可选）" autoComplete="off" onKeyDown={handleKey} />
          <input ref={urlRef} type="text" id="shortcut-url" placeholder="链接，例如 https://example.com" autoComplete="off" onKeyDown={handleKey} />
          <button type="button" className="shortcuts-add" id="shortcut-add" onClick={handleAdd}>添加</button>
        </div>
      </div>
    </div>
  );
}