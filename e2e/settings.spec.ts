import { expect, test } from '@playwright/test';

const SMALL_BG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function quintClick(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function selectBg(page: import('@playwright/test').Page, name: string) {
  const p = page.waitForEvent('filechooser');
  await quintClick(page);
  await p.then(fc => fc.setFiles({ name, mimeType: 'image/png', buffer: SMALL_BG }));
  await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 5000 }).toBe(1);
}

test.describe('设置气泡', () => {
  test('循环播放 toggle', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
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
    await page.goto('/');
    await page.click('#settings-btn');
    const toggle = page.locator('.toggle[data-setting="cycleTypeIsolated"]');
    await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem('bg_cycle_type_isolated'))).toBe('1');
  });

  test('切换周期滑块钳制', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
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
    await selectBg(page, 'a.png');
    await selectBg(page, 'b.png');

    await page.click('#settings-btn');
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
    await page.goto('/');
    await page.click('#settings-btn');
    page.on('dialog', d => d.accept());
    await page.click('#setting-reset');
    await page.waitForTimeout(2000); // reload
    const history = await page.evaluate(() => localStorage.getItem('search_history'));
    expect(history).toBeNull();
    await expect(page.locator('#bg-layer.default-bg')).toHaveCount(1);
  });

  test('重置 dismiss', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    page.on('dialog', d => d.dismiss());
    await page.click('#setting-reset');
    await page.waitForTimeout(500);
    await expect(page.locator('#settings-popover')).toHaveClass(/open/);
  });
});