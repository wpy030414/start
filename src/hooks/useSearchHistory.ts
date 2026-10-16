import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { useRef } from 'react';
import { HISTORY_KEY, MAX_HISTORY } from '../lib/constants';

export interface HistoryEntry {
  q: string;
  engine: string;
  time: number;
}

/**
 * compositionend 之后的冷却窗口：Safari 会在输入法上屏后补发一个
 * `isComposing === false` 的普通 Enter keydown，只能靠时间窗兜底。
 */
const COMPOSITION_GRACE_MS = 100;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) || []) : [];
  } catch {
    return [];
  }
}

/** 组合进行中（不含 compositionend 冷却窗）：Chrome、Firefox 给 isComposing，Safari 可能只给 keyCode 229。 */
function isComposingNow(e: globalThis.KeyboardEvent, composing: boolean): boolean {
  return composing || e.isComposing || e.keyCode === 229 || e.key === 'Process';
}

/**
 * 判断这次 Enter keydown 是否属于输入法上屏（而非搜索）。三层防线：
 * 1. 组合状态 —— 本 hook 自行跟踪的 compositionstart/end，加上原生 isComposing / keyCode 229；
 * 2. 冷却窗口 —— 兜底 Safari 上屏后补发的那一下。
 */
function isImeConfirm(e: globalThis.KeyboardEvent, composing: boolean, compositionEndAt: number): boolean {
  if (isComposingNow(e, composing)) return true;
  return performance.now() - compositionEndAt < COMPOSITION_GRACE_MS;
}

/**
 * 搜索框的键盘语义：输入框保持非受控（ref 直写 value）。
 * - Enter：以当前默认引擎提交（输入法上屏的回车不算）。
 * - ↑/↓：翻阅历史，首个 ↑ 落在**最新**一条，向旧方向推进；↓ 反向退回，
 *       在最新一条再按 ↓ 回到进入翻阅前的原文，队列首尾不相连。
 * - Esc：复位原文并失焦。
 * 去重置顶、上限 100 条，语义与原单文件版一致。
 */
export function useSearchHistory(inputRef: RefObject<HTMLInputElement | null>, onSubmit: (q: string) => void) {
  const historyRef = useRef<HistoryEntry[]>(loadHistory());
  const indexRef = useRef(-1);
  const originalRef = useRef('');
  const composingRef = useRef(false);
  const compositionEndAtRef = useRef(-Infinity);

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
    // 组合中途失焦时 compositionend 不一定会到，避免守卫被永久卡住。
    composingRef.current = false;
  };

  const handleInput = () => {
    indexRef.current = -1;
    originalRef.current = inputRef.current?.value ?? '';
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    compositionEndAtRef.current = performance.now();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    if (!input) return;
    const history = historyRef.current;
    // 组合中（敲拼音、选候选）按键归输入法：这里若 preventDefault 并改写 value，会把正在组合的文本冲掉。
    if (isComposingNow(e.nativeEvent, composingRef.current)) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (indexRef.current < 0) {
        originalRef.current = input.value;
        indexRef.current = 0;
      } else {
        indexRef.current = Math.min(history.length - 1, indexRef.current + 1);
      }
      const entry = history[indexRef.current];
      if (entry) input.value = entry.q;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || indexRef.current < 0) return;
      if (indexRef.current > 0) {
        indexRef.current -= 1;
        const entry = history[indexRef.current];
        if (entry) input.value = entry.q;
      } else {
        input.value = originalRef.current;
        indexRef.current = -1;
      }
    } else if (e.key === 'Enter') {
      if (isImeConfirm(e.nativeEvent, composingRef.current, compositionEndAtRef.current)) return;
      e.preventDefault();
      onSubmit(input.value.trim());
    } else if (e.key === 'Escape') {
      indexRef.current = -1;
      input.value = originalRef.current;
      input.blur();
    }
  };

  return {
    addHistory,
    handleFocus,
    handleBlur,
    handleInput,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
