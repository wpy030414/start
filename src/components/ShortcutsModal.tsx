import { useEffect, useId } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

/**
 * 添加快捷链接弹窗。
 * 面板外壳复用 .modal-mask / .modal-panel（settings-page.css 第 17 节），
 * 与「清除所有数据」「自定义引擎」保持同一套玻璃视觉；Esc 关闭由 HomePage 的全局键盘统一处理。
 */
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
  const titleId = useId();

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
    <div
      id="shortcuts-modal"
      className={`modal-mask${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 className="modal-title" id={titleId}>添加快捷链接</h3>
        <div className="shortcuts-form">
          <input ref={titleRef} type="text" id="shortcut-title" placeholder="标题（可选）" autoComplete="off" onKeyDown={handleKey} />
          <input ref={urlRef} type="text" id="shortcut-url" placeholder="链接，例如 https://example.com" autoComplete="off" onKeyDown={handleKey} />
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-btn" id="shortcut-cancel" onClick={onClose}>取消</button>
          <button type="button" className="modal-btn modal-btn-primary" id="shortcut-add" onClick={handleAdd}>添加</button>
        </div>
      </div>
    </div>
  );
}
