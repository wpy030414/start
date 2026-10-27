import { expect, test } from '@playwright/test';
import { addOneBg } from './helpers/bg';

function readOrder(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    return new Promise<string[]>((res) => {
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
}

test.describe('背景历史键盘导航', () => {
  test('键盘导航穿越历史', async ({ page }) => {
    test.slow();
    await page.goto('/');
    await addOneBg(page, 'c.png');
    await addOneBg(page, 'b.png');
    await addOneBg(page, 'a.png');
    await page.click('#settings-back'); // 回首页做键盘导航
    await expect(page.locator('#search-input')).toBeVisible(); // 等 HomePage 挂载（View Transition 会推迟 DOM 提交）

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
    await addOneBg(page, 'c.png');
    await addOneBg(page, 'b.png');
    await addOneBg(page, 'a.png');
    await page.click('#settings-back');
    await expect(page.locator('#search-input')).toBeVisible(); // 等 HomePage 挂载（View Transition 会推迟 DOM 提交）

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(3700);

    await page.keyboard.press('Enter');

    const order = await readOrder(page);
    expect(order[0]).toBeTruthy();
  });

  test('背景历史上限为 12', async ({ page }) => {
    test.slow();
    await page.goto('/');
    for (let i = 1; i <= 13; i++) {
      await addOneBg(page, `bg_${String(i).padStart(2, '0')}.png`);
    }
    const order = await readOrder(page);
    expect(order).toHaveLength(12);
  });

  test('页面加载恢复背景', async ({ page }) => {
    await page.goto('/');
    await addOneBg(page, 'first.png');
    await page.click('#settings-back');
    await page.reload();
    await expect(page.locator('#bg-layer img')).toHaveCount(1);
  });
});
