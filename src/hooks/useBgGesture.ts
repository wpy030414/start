import { useEffect } from 'react';

const BG_CLICKS_REQUIRED = 5;
const BG_CLICK_WINDOW = 500; // 相邻两次点按的最大间隔（ms）

const EXCLUDE_SELECTOR =
  '#search-card,#shortcuts-showcase,#shortcuts-modal,#help-btn,#help-popover,#settings-btn,#settings-popover';

/** 空白处快速连点 5 次触发选背景（避开搜索框、快捷链接、按钮与气泡区域）。 */
export function useBgGesture(onTrigger: () => void) {
  useEffect(() => {
    let count = 0;
    let last = 0;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(EXCLUDE_SELECTOR)) return;
      const now = Date.now();
      if (now - last > BG_CLICK_WINDOW) count = 0; // 超时则重新计数
      count++;
      last = now;
      if (count >= BG_CLICKS_REQUIRED) {
        count = 0;
        onTrigger();
      }
    };
    document.body.addEventListener('click', onClick);
    return () => document.body.removeEventListener('click', onClick);
  }, [onTrigger]);
}
