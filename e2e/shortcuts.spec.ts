import { expect, test } from '@playwright/test';

async function openModal(page: import('@playwright/test').Page) {
  // webkit 上 goto 后立即派发时 React 的 body 监听器可能尚未挂载，
  // 用 poll 重试派发直到模态打开（chromium 一次即中，webkit 最多重试几次）。
  await expect.poll(async () => {
    await page.evaluate(() =>
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
    );
    return await page.locator('#shortcuts-modal').getAttribute('class');
  }, { timeout: 5000 }).toMatch(/open/);
}

test.describe('快捷链接', () => {
  test('按 + 打开模态，Esc 关闭', async ({ page }) => {
    await page.goto('/');
    await openModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcuts-modal')).not.toHaveClass(/open/);
  });

  test('输入框聚焦时 + 不打开模态', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-input').click();
    await page.evaluate(() =>
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
    );
    await expect(page.locator('#shortcuts-modal')).not.toHaveClass(/open/);
  });

  test('localStorage 存数据后渲染正确', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://example.com', title: 'Test', favicon: '' },
      ]))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(1);
    await expect(page.locator('#shortcuts-showcase .shortcut-title')).toHaveText('Test');
  });

  test('add button 补 https:// 与 title', async ({ page }) => {
    await page.goto('/');
    await openModal(page);
    await page.fill('#shortcut-url', 'example.com');
    await page.fill('#shortcut-title', 'My Site');
    await page.click('#shortcut-add');
    await page.waitForTimeout(5000); // proxy timeouts, catch in tryFetch

    // 验证写入了正确 url
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shortcuts') || '[]'));
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toMatch(/^https:\/\//);
    expect(stored[0].title).toBe('My Site');
  });

  test('dock mouseenter sets --sc', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://a.com', title: 'A', favicon: '' },
        { url: 'https://b.com', title: 'B', favicon: '' },
        { url: 'https://c.com', title: 'C', favicon: '' },
      ]))
    );
    await page.reload();
    const items = page.locator('#shortcuts-showcase .shortcut-item');
    // 用真实鼠标移动触发 React onMouseEnter
    const box = await items.nth(1).boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    const sc = await items.nth(1).evaluate(el => el.style.getPropertyValue('--sc'));
    expect(sc).toBeTruthy();
  });

  test('上限为 6 个', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify(
        Array.from({ length: 7 }, (_, j) => ({ url: `https://x${j}.com`, title: `X${j}`, favicon: '' }))
      ))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(6);
  });

  test('删除逻辑通过 localStorage 验证', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://a.com', title: 'A', favicon: '' },
        { url: 'https://b.com', title: 'B', favicon: '' },
      ]))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(2);
    // 模拟 useShortcutDrag drop 的效果: removeShortcut(0)
    await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('shortcuts') || '[]');
      arr.splice(0, 1);
      localStorage.setItem('shortcuts', JSON.stringify(arr));
    });
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(1);
  });
});