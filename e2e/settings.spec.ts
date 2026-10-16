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

  test('重置 accept', async ({ page }) => {
    await page.goto('/settings');
    page.on('dialog', d => d.accept());
    await page.click('#setting-reset');
    await page.waitForTimeout(2000); // reload
    const history = await page.evaluate(() => localStorage.getItem('search_history'));
    expect(history).toBeNull();
    await expect(page.locator('#bg-layer.default-bg')).toHaveCount(1);
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('重置 dismiss', async ({ page }) => {
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
