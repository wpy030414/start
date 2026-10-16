import { expect, test } from '@playwright/test';
import { addOneBg } from './helpers/bg';

test.describe('设置页', () => {
  test('循环播放 toggle', async ({ page }) => {
    await page.goto('/settings');
    const toggle = page.locator('.toggle[data-setting="cycle"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle'))).toBe('1');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle'))).toBe('0');
  });

  test('循环类型隔离 toggle', async ({ page }) => {
    await page.goto('/settings');
    const toggle = page.locator('.toggle[data-setting="cycleTypeIsolated"]');
    await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_type_isolated'))).toBe('1');
  });

  test('切换周期滑块钳制', async ({ page }) => {
    await page.goto('/settings');
    const slider = page.locator('#cycle-interval');
    await slider.evaluate((el: HTMLInputElement) => {
      const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      native.call(el, '36');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const stored = await page.evaluate(() => localStorage.getItem('bg_cycle_interval'));
    expect(Number(stored)).toBeGreaterThanOrEqual(6);
    expect(Number(stored)).toBeLessThanOrEqual(30);
  });

  test('循环切换', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await addOneBg(page, 'a.png');
    await addOneBg(page, 'b.png');
    // 添加后停留在 /settings；背景层全局常驻，可直接断言

    await page.locator('.toggle[data-setting="cycle"]').click();
    const slider = page.locator('#cycle-interval');
    await slider.evaluate((el: HTMLInputElement) => {
      const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      native.call(el, '7');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const srcBefore = await page.locator('#bg-layer img').first().getAttribute('src');
    await page.waitForTimeout(9000);
    const srcAfter = await page.locator('#bg-layer img').first().getAttribute('src');
    expect(srcAfter).not.toBe(srcBefore);
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
    await page.locator('.toggle[data-setting="cycle"]').click(); // 制造一个可被"保留"验证的状态
    const before = await page.evaluate(() => localStorage.getItem('bg_cycle'));
    page.on('dialog', d => d.dismiss());
    await page.click('#setting-reset');
    await page.waitForTimeout(500);
    // 未 reload、仍在设置页，设置未被清除
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#setting-reset')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle'))).toBe(before);
  });
});
