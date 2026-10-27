import { useEffect, useId, useRef } from 'react';

/**
 * 主题化确认框：替代原生 confirm()。
 * 遮罩点击 / Escape / 取消按钮都可取消；打开时焦点默认落在「取消」上——危险操作的安全默认。
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  confirmId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 危险操作：确认按钮转红（沿用 .setting-reset 的红色玻璃）。 */
  danger?: boolean;
  confirmId?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  // 监听里读最新回调，避免父组件每次重渲染都重挂 document 监听
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      className={`modal-mask${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) cancelRef.current();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 className="modal-title" id={titleId}>
          {title}
        </h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="modal-btn"
            id="confirm-dialog-cancel"
            onClick={() => cancelRef.current()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`modal-btn modal-btn-primary${danger ? ' danger' : ''}`}
            id={confirmId}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
