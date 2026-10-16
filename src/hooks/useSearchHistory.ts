import type { KeyboardEvent, RefObject } from 'react';
import { useRef } from 'react';
import { HISTORY_KEY, MAX_HISTORY } from '../lib/constants';

export interface HistoryEntry {
  q: string;
  engine: string;
  time: number;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) || []) : [];
  } catch {
    return [];
  }
}

/**
 * 搜索历史：输入框保持非受控（ref 直写 value），
 * ↑/↓ 翻阅、Esc 复位失焦、去重置顶、上限 100 条，语义与原单文件版一致。
 */
export function useSearchHistory(inputRef: RefObject<HTMLInputElement | null>) {
  const historyRef = useRef<HistoryEntry[]>(loadHistory());
  const indexRef = useRef(-1);
  const originalRef = useRef('');

  function addHistory(q: string, engine: string) {
    const h = historyRef.current.filter(item => item.q !== q);
    h.unshift({ q, engine, time: Date.now() });
    historyRef.current = h.length > MAX_HISTORY ? h.slice(0, MAX_HISTORY) : h;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyRef.current));
  }

  const handleFocus = () => {
    indexRef.current = -1;
    originalRef.current = inputRef.current?.value ?? '';
  };

  const handleBlur = () => {
    indexRef.current = -1;
  };

  const handleInput = () => {
    indexRef.current = -1;
    originalRef.current = inputRef.current?.value ?? '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    if (!input) return;
    const history = historyRef.current;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (indexRef.current < 0) {
        indexRef.current = history.length - 1;
        originalRef.current = input.value;
      } else {
        indexRef.current = Math.max(0, indexRef.current - 1);
      }
      if (history[indexRef.current]) input.value = history[indexRef.current].q;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || indexRef.current < 0) return;
      if (indexRef.current < history.length - 1) {
        indexRef.current++;
        if (history[indexRef.current]) input.value = history[indexRef.current].q;
      } else {
        input.value = originalRef.current;
        indexRef.current = -1;
      }
    } else if (e.key === 'Escape') {
      indexRef.current = -1;
      input.value = originalRef.current;
      input.blur();
    }
  };

  return { addHistory, handleFocus, handleBlur, handleInput, handleKeyDown };
}
