/* 旧 Service Worker（/worker.js）的墓碑：
 * install→skipWaiting，activate→清全部旧缓存并 self-unregister。
 * 部署后旧 SW 字节比对更新即换为墓碑，一次加载完成迁移。
 * 注意：本文件是原样托管到 public/ 的纯 JS，不能写 TS 语法（否则浏览器解析即报错）。 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
  void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  self.registration.unregister();
});
