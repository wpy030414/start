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
});

test.describe('设置气泡', () => {
  test('点击齿轮打开，点外关闭', async ({ page }) => {
    await page.goto('/');
    const popover = page.locator('#settings-popover');
    await page.click('#settings-btn');
    await expect(popover).toHaveClass(/open/);
    await page.mouse.click(640, 200);
    await expect(popover).not.toHaveClass(/open/);
  });

  test('Escape 关闭', async ({ page }) => {
    await page.goto('/');
    const popover = page.locator('#settings-popover');
    await page.click('#settings-btn');
    await expect(popover).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(popover).not.toHaveClass(/open/);
  });

  test('帮助与设置互斥', async ({ page }) => {
    await page.goto('/');
    const help = page.locator('#help-popover');
    const settings = page.locator('#settings-popover');

    await page.click('#help-btn');
    await expect(help).toHaveClass(/open/);
    await page.click('#settings-btn'); // 直接切换，先关帮助
    await expect(help).not.toHaveClass(/open/);
    await expect(settings).toHaveClass(/open/);

    await page.click('#help-btn');
    await expect(settings).not.toHaveClass(/open/);
    await expect(help).toHaveClass(/open/);
  });
});
