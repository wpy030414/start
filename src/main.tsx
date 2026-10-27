import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { migrateLegacySW } from './sw-migrate';

/** GitHub Pages 404.html 深链兜底：/?spa=<encoded path+search+hash> → 还原真实路径。
 *  URLSearchParams.get 已解码一次，勿再 decodeURIComponent（二次解码 bug）。 */
function consumeSpaRedirect(): void {
  const spa = new URLSearchParams(location.search).get('spa');
  if (!spa) return;
  let target = spa;
  // 只接受站内绝对路径；拒绝协议相对 // 与 /\（防外站跳转/抛 SecurityError）
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) target = '/';
  try {
    history.replaceState(null, '', target);
  } catch {
    /* 非法则留在 / */
  }
}

consumeSpaRedirect();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// VitePWA auto-injects registration (injectRegister: 'auto')，
// 这里只需清理旧 SW 缓存（在 auto registration 之前）。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    migrateLegacySW().catch(() => {});
  });
}
