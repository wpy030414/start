import { useEffect, useState } from 'react';

/* 极简 path 路由：无外部依赖。
 * pushState 不触发 popstate，navigateTo 手动派发合成事件；
 * history.back()/forward() 走浏览器原生 popstate，同一 listener 覆盖两路。
 * 冷深链（如 GitHub Pages 上的 /settings）由 public/404.html 兜底为 /?spa=<path>，
 * main.tsx 在渲染前还原真实路径。
 */

export function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

export function usePath(): string {
  const [path, setPath] = useState(() => normalizePath(location.pathname));
  useEffect(() => {
    const onPop = () => setPath(normalizePath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function navigateTo(path: string): void {
  if (normalizePath(location.pathname) === normalizePath(path)) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
