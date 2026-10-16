import { expect, test } from '@playwright/test';
import { addOneBg } from './helpers/bg';

function setSlider(el: import('@playwright/test').Locator, value: string) {
  return el.evaluate((node: HTMLInputElement, v: string) => {
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    native.call(node, v);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.describe('设置页', () => {
  test('循环播放周期离散滑块三档持久化', async ({ page }) => {
    await page.goto('/settings');
    const slider = page.locator('#cycle-mode');
    // 默认不循环（最后一档）
    await expect(slider).toHaveValue('2');
    await expect(page.locator('.slider-ticks')).toHaveText(/6s\s*30s\s*不循环/);

    await setSlider(slider, '0');
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_mode'))).toBe('6');
    await expect(slider).toHaveValue('0');

    await setSlider(slider, '1');
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_mode'))).toBe('30');
    await setSlider(slider, '2');
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_mode'))).toBe('off');
  });

  test('旧版 bg_cycle 设置迁移到档位', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bg_cycle', '1');
      localStorage.setItem('bg_cycle_interval', '20');
    });
    await page.goto('/settings');
    // >18s 归入 30s 档
    await expect(page.locator('#cycle-mode')).toHaveValue('1');
  });

  test('循环切换（6s 档）', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await addOneBg(page, 'a.png');
    await addOneBg(page, 'b.png');
    // 添加后停留在 /settings；背景层全局常驻，可直接断言

    const slider = page.locator('#cycle-mode');
    await setSlider(slider, '0'); // 6s

    const srcBefore = await page.locator('#bg-layer img').first().getAttribute('src');
    await page.waitForTimeout(9000);
    const srcAfter = await page.locator('#bg-layer img').first().getAttribute('src');
    expect(srcAfter).not.toBe(srcBefore);
  });

  test('不循环档不切换', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await addOneBg(page, 'a.png');
    await addOneBg(page, 'b.png');
    await page.waitForTimeout(4000); // 等 crossfade settle，取稳定基准
    await expect(page.locator('#cycle-mode')).toHaveValue('2'); // 默认不循环

    const srcBefore = await page.locator('#bg-layer img').first().getAttribute('src');
    await page.waitForTimeout(8000);
    const srcAfter = await page.locator('#bg-layer img').first().getAttribute('src');
    expect(srcAfter).toBe(srcBefore);
  });

  test('「清除所有数据」位于标题行右侧，且不再占用独立小节', async ({ page }) => {
    await page.goto('/settings');
    const header = page.locator('.settings-header');
    await expect(header.locator('#setting-reset')).toHaveCount(1);

    // 几何断言：按钮起点在标题「设置」右侧
    const title = await header.locator('h2').boundingBox();
    const btn = await header.locator('#setting-reset').boundingBox();
    expect(btn!.x).toBeGreaterThan(title!.x + title!.width);

    // 原「通用」小节已移除
    await expect(page.locator('.settings-section h3', { hasText: '通用' })).toHaveCount(0);
    await expect(page.locator('.settings-section')).toHaveCount(2); // 背景 + 搜索引擎
  });

  test('清除所有数据 accept：存储 / 缓存 / SW 注册全清，且重载后页面不白屏', async ({ page }) => {
    await page.goto('/');
    await addOneBg(page, 'a.png'); // 写入 IndexedDB
    await page.evaluate(() => {
      localStorage.setItem('shortcuts', JSON.stringify([{ name: 'x', url: 'https://x.com/' }]));
    });
    // 先确认确有东西可清：SW 注册已 activated 且 workbox 预缓存已建立。
    // 刻意不依赖 navigator.serviceWorker.controller —— WebKit 下若在 SW 激活前
    // 就导航到 /settings，新文档不会被接管，controller 会一直为 null（浏览器时序特性）。
    await expect.poll(
      () => page.evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.some(r => r.active?.state === 'activated');
      }),
      { timeout: 15000 },
    ).toBe(true);
    await expect.poll(
      () => page.evaluate(() => caches.keys().then(k => k.length)),
      { timeout: 15000 },
    ).toBeGreaterThan(0);

    // 重载文档「零点」快照：早于应用脚本与 SW 重新注册，避开竞态
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.__wipeProbe = {
        lsKeys: Object.keys(localStorage),
        cacheKeys: caches.keys(),
        swCount: navigator.serviceWorker.getRegistrations().then(r => r.length),
      };
    });

    page.on('dialog', d => d.accept());
    await page.click('#setting-reset');
    await page.waitForTimeout(2500); // reload 落地

    // 关键回归点：navigateFallback 依赖的 index.html 已随缓存删掉，
    // 若旧 SW 仍控页则此处会白屏 —— 页面正常即证明清退生效。
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#settings-page')).toBeVisible();
    await expect(page.locator('#setting-reset')).toBeVisible();

    const probe = await page.evaluate(async () => {
      const w = window as unknown as {
        __wipeProbe: { lsKeys: string[]; cacheKeys: Promise<string[]>; swCount: Promise<number> };
      };
      return {
        lsKeys: w.__wipeProbe.lsKeys,
        cacheKeys: await w.__wipeProbe.cacheKeys,
        swCount: await w.__wipeProbe.swCount,
      };
    });
    expect(probe.lsKeys).toEqual([]);
    expect(probe.cacheKeys).toEqual([]);
    expect(probe.swCount).toBe(0);

    // 背景库已清空 → 回默认波点底，网格为空
    await expect(page.locator('#bg-layer.default-bg')).toHaveCount(1);
    await expect(page.locator('.bg-item')).toHaveCount(0);
  });

  test('清除所有数据 dismiss：不做任何清除', async ({ page }) => {
    await page.goto('/settings');
    await setSlider(page.locator('#cycle-mode'), '0'); // 制造一个可被"保留"验证的状态
    page.on('dialog', d => d.dismiss());
    await page.click('#setting-reset');
    await page.waitForTimeout(500);
    // 未 reload、仍在设置页，设置未被清除
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#setting-reset')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_mode'))).toBe('6');
  });
});
