import { expect, test } from '@playwright/test';

test.describe('帮助气泡', () => {
  test('点击 ? 打开，点外关闭', async ({ page }) => {
    await page.goto('/');
    const popover = page.locator('#help-popover');
    await expect(popover).not.toHaveClass(/open/);

    await page.click('#help-btn');
    await expect(popover).toHaveClass(/open/);
    await expect(popover).toHaveAttribute('aria-hidden', 'false');

    await page.mouse.click(50, 200); // 气泡与按钮之外的区域
    await expect(popover).not.toHaveClass(/open/);
  });

  test('Escape 关闭', async ({ page }) => {
    await page.goto('/');
    const popover = page.locator('#help-popover');
    await page.click('#help-btn');
    await expect(popover).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(popover).not.toHaveClass(/open/);
  });

  test('不含「背景」5 连点说明（仅 4 条）', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn');
    const items = page.locator('#help-popover li');
    await expect(items).toHaveCount(4);
    await expect(page.locator('#help-popover')).not.toContainText('连续点按');
  });
});

test.describe('设置入口', () => {
  test('左下角齿轮跳转到 /settings', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#settings-page')).toBeVisible();
    await expect(page.locator('#search-input')).toHaveCount(0);
    // 首页元素不再渲染
    await expect(page.locator('#help-btn')).toHaveCount(0);
  });
});
