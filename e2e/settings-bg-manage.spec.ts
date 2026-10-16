import { expect, test, type Page } from '@playwright/test';
import { addBgViaSettings } from './helpers/bg';

function readOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
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
}

test.describe('设置页背景管理', () => {
  test('缩略图列表与当前项高亮（多选添加后当前为最后一个）', async ({ page }) => {
    await page.goto('/settings');
    await addBgViaSettings(page, [{ name: 'a.png' }, { name: 'b.png' }]);

    await expect(page.locator('.bg-item')).toHaveCount(2);
    await expect(page.locator('.bg-item .bg-thumb')).toHaveCount(2);
    await expect(page.locator('.bg-item.current')).toHaveCount(1);
    // 多选添加：b 后应用 → 排序 [b, a]，第一项为当前且按钮禁用
    await expect(page.locator('.bg-item').first()).toHaveClass(/current/);
    await expect(page.locator('.bg-item').first().locator('.bg-apply')).toBeDisabled();
  });

  test('设为当前：切换并置顶', async ({ page }) => {
    await page.goto('/settings');
    await addBgViaSettings(page, [{ name: 'a.png' }, { name: 'b.png' }]);
    await expect(page.locator('.bg-item')).toHaveCount(2);

    // 点非当前项（a，第二项）的「设为当前」
    await page.locator('.bg-item').last().locator('.bg-apply').click();
    await expect(page.locator('.bg-item').first()).toHaveClass(/current/);
    await expect(page.locator('.bg-item.current')).toHaveCount(1);

    // 置顶持久化：IDB order[0] === 当前项 hash（promoteCurrent 异步持久化，poll 等待）
    const hash = await page.locator('.bg-item.current').getAttribute('data-hash');
    await expect.poll(async () => (await readOrder(page))[0]).toBe(hash);
  });

  test('删除非当前项不影响展示', async ({ page }) => {
    await page.goto('/settings');
    await addBgViaSettings(page, [{ name: 'a.png' }, { name: 'b.png' }]);
    await expect(page.locator('.bg-item')).toHaveCount(2);
    await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 6000 }).toBe(1); // 等 settle
    const src = await page.locator('#bg-layer img').first().getAttribute('src');

    // 删非当前项（a，第二项）
    await page.locator('.bg-item').last().locator('.bg-delete').click();
    await expect(page.locator('.bg-item')).toHaveCount(1);
    expect(await page.locator('#bg-layer img').first().getAttribute('src')).toBe(src);
  });

  test('删除当前项切换到剩余项', async ({ page }) => {
    await page.goto('/settings');
    await addBgViaSettings(page, [{ name: 'a.png' }, { name: 'b.png' }]);
    await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 6000 }).toBe(1); // 等 settle
    const before = await page.locator('#bg-layer img').first().getAttribute('src');

    await page.locator('.bg-item.current').locator('.bg-delete').click();
    await expect(page.locator('.bg-item')).toHaveCount(1);
    await expect
      .poll(() => page.locator('#bg-layer img').first().getAttribute('src'), { timeout: 5000 })
      .not.toBe(before);
  });

  test('删除唯一背景回到默认底', async ({ page }) => {
    await page.goto('/settings');
    await addBgViaSettings(page, [{ name: 'only.png' }]);
    await expect(page.locator('.bg-item')).toHaveCount(1);

    await page.locator('.bg-item .bg-delete').click();
    await expect(page.locator('.bg-item')).toHaveCount(0);
    await expect(page.locator('.bg-empty')).toBeVisible();
    await expect(page.locator('#bg-layer')).toHaveClass(/default-bg/);
  });
});
