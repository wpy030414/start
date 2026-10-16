import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 气泡开关：点击气泡外部或按 Escape 关闭。
 * 打开时才挂全局监听；互斥逻辑由调用方（App 层）在 toggle 中处理。
 */
export function usePopover({
  buttonRef,
  popoverRef,
}: {
  buttonRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, buttonRef, popoverRef]);

  return { open, setOpen };
}
