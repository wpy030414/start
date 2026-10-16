import { expect, test } from '@playwright/test';
import { SMALL_PNG } from './helpers/bg';

test.describe('路由', () => {
  test('齿轮导航到设置页，返回链接回首页', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#settings-page')).toBeVisible();

    await page.click('#settings-back');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('深链直达 /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#settings-page')).toBeVisible();
    await expect(page.locator('#search-input')).toHaveCount(0);
  });

  test('浏览器后退/前进', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    await expect(page).toHaveURL(/\/settings$/);
    await page.goBack();
    await expect(page.locator('#search-input')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#settings-page')).toBeVisible();
  });

  test('?spa= 重定向参数还原路径（GH Pages 404.html 兜底链路）', async ({ page }) => {
    await page.goto('/?spa=' + encodeURIComponent('/settings'));
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#settings-page')).toBeVisible();
  });

  test('跨路由背景常驻：设置页添加后回首页背景不重载', async ({ page }) => {
    await page.goto('/settings');
    const fcPromise = page.waitForEvent('filechooser');
    await page.click('#add-bg-btn');
    const fc = await fcPromise;
    await fc.setFiles({ name: 'route.png', mimeType: 'image/png', buffer: SMALL_PNG });
    await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 5000 }).toBe(1);
    const src = await page.locator('#bg-layer img').first().getAttribute('src');

    await page.click('#settings-back');
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#bg-layer img')).toHaveCount(1);
    expect(await page.locator('#bg-layer img').first().getAttribute('src')).toBe(src);
  });
});
