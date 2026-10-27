import { expect, test } from '@playwright/test';

test.describe('离线与 PWA', () => {
  test('Service Worker 注册并以 sw.js 结尾', async ({ page }) => {
    await page.goto('/');
    // 等待 SW 就绪
    await expect
      .poll(
        async () => {
          const ctrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
          return ctrl;
        },
        { timeout: 15000 },
      )
      .toMatch(/\/sw\.js$/);
  });

  test('离线状态下页面仍然可用', async ({ page }) => {
    await page.goto('/');
    // 等 SW 激活
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''), {
        timeout: 15000,
      })
      .toContain('/sw.js');

    // 断网 → reload
    await page.context().setOffline(true);
    await page.reload();

    // 核心 UI 仍在（预缓存 + navigateFallback）
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('Workbox 预缓存已建立', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(
        async () => {
          const keys = await page.evaluate(() => caches.keys());
          return keys.some((k) => k.startsWith('workbox-'));
        },
        { timeout: 15000 },
      )
      .toBe(true);
  });

  test('旧 SW 缓存被清理', async ({ page }) => {
    // 预置旧缓存（模拟旧版本）
    await page.goto('/');
    await page.evaluate(async () => {
      const c = await caches.open('main-v1');
      await c.put('/index.html', new Response('<html></html>'));
      await caches.open('static-v1');
    });
    await page.reload();
    // migrateLegacySW 在 load 事件后执行，等待生效
    await page.waitForTimeout(1000);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys.some((k) => k.startsWith('main-'))).toBe(false);
    expect(keys.some((k) => k.startsWith('static-'))).toBe(false);
  });

  test('sw_main_meta IndexedDB 被清理', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      return new Promise<void>((res) => {
        const r = indexedDB.open('sw_main_meta', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('cacheMeta');
        r.onsuccess = () => {
          r.result.close();
          res();
        };
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);
    const dbs = await page.evaluate(async () => {
      const list = await indexedDB.databases();
      return list.map((d) => d.name);
    });
    expect(dbs).not.toContain('sw_main_meta');
  });
});
