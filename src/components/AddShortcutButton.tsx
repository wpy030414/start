import type { RefObject } from 'react';
import GlassBackdrop from './GlassBackdrop';
import { PlusIcon, TrashIcon } from './icons';

/**
 * 左上角「+」：唯一的添加入口（`+` 按键已下线）。
 *
 * 拖动快捷链接时它就地变成红色垃圾桶胶囊（宽度张开、加号让位给垃圾桶图标 + 文案），
 * 松手即删 —— 所以它同时是「新增」与「删除落点」两个角色，不再需要单独的右下角垃圾桶。
 * 玻璃材质层始终挂在同一个节点上，`fluid` 让轮廓跟着宽度变化弹性变形。
 */
export default function AddShortcutButton({
  rootRef,
  onClick,
  isDragging,
  dropHover,
}: {
  rootRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  isDragging: boolean;
  dropHover: boolean;
}) {
  const cls = ['corner-btn', 'add-btn'];
  if (isDragging) cls.push('dragging-trash');
  if (dropHover) cls.push('drop-target');

  return (
    <button
      ref={rootRef}
      type="button"
      id="add-shortcut-btn"
      className={cls.join(' ')}
      title={isDragging ? '拖到这里删除' : '添加快捷链接'}
      aria-label={isDragging ? '拖到这里删除' : '添加快捷链接'}
      onClick={onClick}
    >
      <GlassBackdrop className="corner-btn-bg" radius="capsule" refraction={14} fluid />
      <span className="corner-btn-icon add-btn-icon" aria-hidden="true">
        <PlusIcon />
      </span>
      <span className="add-btn-trash" aria-hidden="true">
        <TrashIcon />
        <span>拖到这里删除</span>
      </span>
    </button>
  );
}
