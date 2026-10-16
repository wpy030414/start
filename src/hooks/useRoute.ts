import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/* 极简 path 路由：无外部依赖。
 * pushState 不触发 popstate，navigateTo 手动派发合成事件；
 * history.back()/forward() 走浏览器原生 popstate，同一 listener 覆盖两路。
 * 路由切换包在 View Transitions 里（齿轮气泡 ↔ 设置卡的容器变形，
 * 见 buttons.css / settings-page.css 的 view-transition-name 配对）；
 * 不支持该 API 的浏览器瞬时切换。冷深链（如 GitHub Pages 上的 /settings）
 * 由 public/404.html 兜底为 /?spa=<path>，main.tsx 在渲染前还原真实路径。
 */

/** 以 View Transition 包裹路由状态更新（flushSync 保证回调返回前 DOM 已提交）。 */
function applyPathUpdate(update: () => void): void {
  // 不假设 lib.dom 已含 View Transitions 类型，防御式取用
  const startVT = (document as unknown as {
    startViewTransition?: (callback: () => void) => unknown;
  }).startViewTransition;
  if (typeof startVT === 'function') {
    startVT.call(document, () => flushSync(update));
  } else {
    update();
  }
}

export function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

export function usePath(): string {
  const [path, setPath] = useState(() => normalizePath(location.pathname));
  useEffect(() => {
    const onPop = () => applyPathUpdate(() => setPath(normalizePath(location.pathname)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function navigateTo(path: string): void {
  if (normalizePath(location.pathname) === normalizePath(path)) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate')); // 监听器内统一走 applyPathUpdate
}
