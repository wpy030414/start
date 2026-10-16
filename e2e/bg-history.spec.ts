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

test.describe('背景历史键盘导航', () => {
  test('键盘导航穿越历史', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await selectBg(page, 'c.png');
    await selectBg(page, 'b.png');
    await selectBg(page, 'a.png');

    // ← 切换到上一张 (b)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700); // 等 3.5s 兜底 settle
    const imgsAfterLeft1 = page.locator('#bg-layer img');
    await expect(imgsAfterLeft1).toHaveCount(1);

    // 再 ← 切换到再上一张 (c)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700);
    await expect(page.locator('#bg-layer img')).toHaveCount(1);

    // 已到最旧，再 ← 不应再增加层（不会触发新 applyBackground）
    const beforeExtra = await page.locator('#bg-layer img').first().getAttribute('src');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(4000);
    const afterExtra = await page.locator('#bg-layer img').first().getAttribute('src');
    expect(afterExtra).toBe(beforeExtra); // 到边界不变

    // → 回退到前一张 (b)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(3700);
    await expect(page.locator('#bg-layer img')).toHaveCount(1);
    const afterRight = await page.locator('#bg-layer img').first().getAttribute('src');
    expect(afterRight).not.toBe(beforeExtra);
  });

  test('Enter 置顶背景', async ({ page }) => {
    await page.goto('/');
    await selectBg(page, 'c.png');
    await selectBg(page, 'b.png');
    await selectBg(page, 'a.png');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700);

    await page.keyboard.press('Enter');

    const order = await page.evaluate(() => {
      return new Promise<string[]>(res => {
        const r = indexedDB.open('start', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('background', 'readonly');
          const g = tx.objectStore('background').get('order');
          g.onsuccess = () => res(g.result);
          g.onerror = () => res([]);
        };
      });
    });
    expect(order[0]).toBeTruthy();
  });

  test('背景历史上限为 10', async ({ page }) => {
    test.slow();
    await page.goto('/');
    for (let i = 1; i <= 11; i++) {
      await selectBg(page, `bg_${String(i).padStart(2, '0')}.png`);
    }
    const order = await page.evaluate(() => {
      return new Promise<string[]>(res => {
        const r = indexedDB.open('start', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('background', 'readonly');
          const g = tx.objectStore('background').get('order');
          g.onsuccess = () => res(g.result || []);
          g.onerror = () => res([]);
        };
      });
    });
    expect(order).toHaveLength(10);
  });

  test('页面加载恢复背景', async ({ page }) => {
    await page.goto('/');
    await selectBg(page, 'first.png');
    await page.reload();
    await expect(page.locator('#bg-layer img')).toHaveCount(1);
  });
});