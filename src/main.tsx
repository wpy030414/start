import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { migrateLegacySW } from './sw-migrate';

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