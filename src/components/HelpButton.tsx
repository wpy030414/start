import type { RefObject } from 'react';
import { TrashIcon } from './icons';

export default function HelpButton({
  rootRef,
  onClick,
}: {
  rootRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  return (
    <button
      ref={rootRef}
      type="button"
      id="help-btn"
      className="help-btn"
      title="使用帮助"
      aria-label="使用帮助"
      onClick={onClick}
    >
      <span className="help-btn-icon">?</span>
      <span className="help-btn-trash" aria-hidden="true">
        <TrashIcon />
        <span>拖到这里删除</span>
      </span>
    </button>
  );
}
