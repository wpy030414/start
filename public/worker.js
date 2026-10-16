/* 旧 Service Worker（/worker.js）的墓碑：
 * install→skipWaiting，activate→清全部旧缓存并 self-unregister。
 * 部署后旧 SW 字节比对更新即换为墓碑，一次加载完成迁移。 */
self.addEventListener('install', () => {
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener('activate', () => {
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  self.registration.unregister();
});