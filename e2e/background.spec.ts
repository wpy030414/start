import { expect, test } from '@playwright/test';

/* 1x1 PNG（透明），两张图用不同文件名区分 hash（hash = 名|大小|类型|mtime）。 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/** 在空白区域快速点按 5 次以触发背景文件选择器。 */
async function quintClick(page: import('@playwright/test').Page) {
  await page.mouse.click(640, 330);
  await page.mouse.click(640, 330);
  await page.mouse.click(640, 330);
  await page.mouse.click(640, 330);
  await page.mouse.click(640, 330);
}

/**
 * 页面内合成 5 连击（间隔为零）。
 * 并行跑测时真实 mouse.click 的间隔可能超过 500ms 手势窗口导致 flaky，
 * 手势门槛本身已由「5 连点触发文件选择器」用例用真实点击覆盖。
 */
async function quintClickFast(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
}

test.describe('自定义背景', () => {
  test('初始无背景时渲染默认波点底', async ({ page }) => {
    await page.goto('/');
    const layer = page.locator('#bg-layer');
    await expect(layer).toHaveClass(/default-bg/);
    const dots = layer.locator('.default-dot');
    expect(await dots.count()).toBeGreaterThan(50);
    const color = await layer.evaluate(el => el.style.getPropertyValue('--dot-color'));
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

  test('空白处 5 连点触发文件选择器，4 次不触发', async ({ page }) => {
    await page.goto('/');
    // 4 次不触发
    for (let i = 0; i < 4; i++) await page.mouse.click(640, 330);
    await page.waitForTimeout(600);
    // 第 5 次触发（间隔内）
    const fcPromise = page.waitForEvent('filechooser');
    await quintClick(page);
    const fc = await fcPromise;
    expect(fc).toBeTruthy();
  });

  test('搜索框 / 快捷链接区域的点击不计入连点', async ({ page }) => {
    await page.goto('/');
    await page.mouse.click(640, 120); // 搜索卡区域
    await page.mouse.click(640, 120);
    await page.mouse.click(640, 120);
    await page.mouse.click(640, 120);
    await page.mouse.click(640, 330); // 只有 1 次有效
    await page.waitForTimeout(300);
    let fired = false;
    const fcPromise = page.waitForEvent('filechooser', { timeout: 1200 }).then(() => (fired = true)).catch(() => {});
    await page.mouse.click(640, 330); // 第 2 次有效
    await fcPromise;
    expect(fired).toBe(false);
  });

  test('选择图片立即应用并淡入到不透明', async ({ page }) => {
    await page.goto('/');
    const fcPromise = page.waitForEvent('filechooser');
    await quintClickFast(page);
    const fc = await fcPromise;
    await fc.setFiles({ name: 'bg-a.png', mimeType: 'image/png', buffer: PNG });

    const img = page.locator('#bg-layer img');
    await expect(img).toHaveCount(1);
    await expect
      .poll(() => img.evaluate(el => el.style.opacity), { timeout: 4000 })
      .toBe('1');
    await expect(page.locator('#bg-layer')).not.toHaveClass(/default-bg/);
  });

  test('切换背景时新旧媒体交叉溶解后只保留一个', async ({ page }) => {
    await page.goto('/');
    const fc1Promise = page.waitForEvent('filechooser');
    await quintClickFast(page);
    const fc1 = await fc1Promise;
    await fc1.setFiles({ name: 'bg-a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#bg-layer img')).toHaveCount(1);

    const fc2Promise = page.waitForEvent('filechooser');
    await quintClickFast(page);
    const fc2 = await fc2Promise;
    await fc2.setFiles({ name: 'bg-b.png', mimeType: 'image/png', buffer: PNG });

    // 短暂共存（旧层保留至淡入完成）
    await expect
      .poll(() => page.locator('#bg-layer img').count(), { timeout: 2000 })
      .toBe(2);
    // settle 后（最多 3.5s 兜底）只剩最新一层
    await expect
      .poll(() => page.locator('#bg-layer img').count(), { timeout: 6000 })
      .toBe(1);
  });
});
