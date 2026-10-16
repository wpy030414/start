import type { RefObject } from 'react';
import { TrashIcon } from './icons';

export default function HelpButton({
  rootRef, onClick, isDragging, dropHover,
}: {
  rootRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  isDragging: boolean;
  dropHover: boolean;
}) {
  const cls = ['help-btn'];
  if (isDragging) cls.push('dragging-trash');
  if (dropHover) cls.push('drop-target');

  return (
    <button ref={rootRef} type="button" id="help-btn" className={cls.join(' ')} title="使用帮助" aria-label="使用帮助" onClick={onClick}>
      <span className="help-btn-icon">?</span>
      <span className="help-btn-trash" aria-hidden="true">
        <TrashIcon />
        <span>拖到这里删除</span>
      </span>
    </button>
  );
}