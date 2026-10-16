/* 注销旧 /worker.js（含 active/waiting/installing 任一形态）、
 * 清理其 Cache（main-* / static-*）和元数据 IndexedDB（sw_main_meta）。 */
export async function migrateLegacySW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const LEGACY_SW_PATH = '/worker.js';
  const LEGACY_CACHE_PREFIXES = ['main-', 'static-'];
  const LEGACY_DB = 'sw_main_meta';

  // 1. 注销旧注册
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    const sw = reg.active ?? reg.waiting ?? reg.installing;
    if (sw && new URL(sw.scriptURL, location.origin).pathname === LEGACY_SW_PATH) {
      await reg.unregister();
    }
  }

  // 2. 清理旧缓存
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(k => LEGACY_CACHE_PREFIXES.some(p => k.startsWith(p)))
      .map(k => caches.delete(k)),
  );

  // 3. 删除旧 SW 元数据 IndexedDB
  try {
    indexedDB.deleteDatabase(LEGACY_DB);
  } catch {
    /* noop */
  }
}