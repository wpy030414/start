import { expect, test } from '@playwright/test';
import { SMALL_PNG, addOneBg } from './helpers/bg';

test.describe('自定义背景', () => {
  test('初始无背景时渲染默认波点底', async ({ page }) => {
    await page.goto('/');
    const layer = page.locator('#bg-layer');
    await expect(layer).toHaveClass(/default-bg/);
    const dots = layer.locator('.default-dot');
    expect(await dots.count()).toBeGreaterThan(50);
    const color = await layer.evaluate((el) => el.style.getPropertyValue('--dot-color'));
    expect(['#3ec27a', '#ff79a6', '#ff9d3d']).toContain(color);
  });

  test('窗口尺寸变化时防抖重绘波点', async ({ page }) => {
    await page.goto('/');
    const dots = page.locator('#bg-layer .default-dot');
    const before = await dots.count();
    await page.setViewportSize({ width: 1600, height: 720 });
    await page.waitForTimeout(500); // 200ms 防抖 + 重绘
    const after = await dots.count();
    expect(after).toBeGreaterThan(before);
  });

  test('首页 5 连点不再触发文件选择器', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) await page.mouse.click(640, 330);
    const fired = await page.waitForEvent('filechooser', { timeout: 1200 }).then(
      () => true,
      () => false,
    );
    expect(fired).toBe(false);
    await expect(page).toHaveURL(/\/$/);
  });

  test('通过设置页添加图片立即应用并淡入到不透明', async ({ page }) => {
    await page.goto('/');
    await addOneBg(page, 'bg-a.png');

    const img = page.locator('#bg-layer img');
    await expect(img).toHaveCount(1);
    await expect.poll(() => img.evaluate((el) => el.style.opacity), { timeout: 4000 }).toBe('1');
    await expect(page.locator('#bg-layer')).not.toHaveClass(/default-bg/);
  });

  test('切换背景时新旧媒体交叉溶解后只保留一个', async ({ page }) => {
    await page.goto('/');
    await addOneBg(page, 'bg-a.png'); // 添加后停留在 /settings，背景层全局可见
    await expect(page.locator('#bg-layer img')).toHaveCount(1);

    const fcPromise = page.waitForEvent('filechooser');
    await page.click('#add-bg-btn');
    const fc = await fcPromise;
    await fc.setFiles({ name: 'bg-b.png', mimeType: 'image/png', buffer: SMALL_PNG });

    // 短暂共存（旧层保留至淡入完成）
    await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 2000 }).toBe(2);
    // settle 后（最多 3.5s 兜底）只剩最新一层
    await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 6000 }).toBe(1);
  });
});
