import { expect, test } from '@playwright/test';

/**
 * 角标契约：帮助入口已移除，首页左右上角各一颗玻璃按钮 ——
 * 左上 `+`（添加，兼拖拽删除落点）、右上齿轮（设置）。
 */
test.describe('首页角标', () => {
  test('帮助入口彻底不存在', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#help-btn')).toHaveCount(0);
    await expect(page.locator('#help-popover')).toHaveCount(0);
    await expect(page.locator('.help-btn')).toHaveCount(0);
  });

  test('右上角齿轮跳转到 /settings', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#settings-btn');
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThan(viewport.width / 2);
    expect(box!.y).toBeLessThan(120);

    await btn.click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#settings-page')).toBeVisible();
    await expect(page.locator('#search-input')).toHaveCount(0);
    await expect(page.locator('#settings-btn')).toHaveCount(0);
    await expect(page.locator('#add-shortcut-btn')).toHaveCount(0);
  });

  test('左上角 + 打开添加模态', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#add-shortcut-btn');
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeLessThan(viewport.width / 2);
    expect(box!.y).toBeLessThan(120);

    await btn.click();
    await expect(page.locator('#shortcuts-modal')).toHaveClass(/open/);
  });

  test('拖动快捷链接：代理跟随光标 → + 变垃圾桶 → 松手即删除', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://a.com', title: 'A', favicon: '' },
        { url: 'https://b.com', title: 'B', favicon: '' },
      ]))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(2);

    const addBtn = page.locator('#add-shortcut-btn');
    await expect(addBtn).not.toHaveClass(/dragging-trash/);

    // 拖第一个（index 0）：顺带守住「0 被当成 falsy 导致代理不动」的回归
    const item = page.locator('.shortcut-item').first();
    const ib = (await item.boundingBox())!;
    await page.mouse.move(ib.x + 30, ib.y + 30);
    await page.mouse.down();
    await page.mouse.move(ib.x + 60, ib.y + 60, { steps: 5 });
    await expect(addBtn).toHaveClass(/dragging-trash/);
    const proxyTx = () => page.locator('.shortcut-proxy').evaluate(el => (el as HTMLElement).style.transform);
    const t0 = await proxyTx();
    await page.mouse.move(400, 300, { steps: 12 });
    expect(await proxyTx(), '拖拽代理必须跟随光标').not.toBe(t0);

    // 拖到 + 上松手 → 删除，并且拖拽态彻底退出
    const ab = (await addBtn.boundingBox())!;
    await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(1);
    await expect(page.locator('.shortcut-proxy')).toHaveCount(0);
    await expect(addBtn).not.toHaveClass(/dragging-trash/);
    await expect(page.locator('body')).not.toHaveClass(/is-dragging-shortcut/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shortcuts') || '[]'));
    expect(stored).toHaveLength(1);
  });

  test('拖到别处松手：不删除，且完全退出拖拽态', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://a.com', title: 'A', favicon: '' },
        { url: 'https://b.com', title: 'B', favicon: '' },
      ]))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(2);

    const ib = (await page.locator('.shortcut-item').nth(1).boundingBox())!;
    await page.mouse.move(ib.x + 30, ib.y + 30);
    await page.mouse.down();
    await page.mouse.move(300, 400, { steps: 10 });
    await expect(page.locator('.shortcut-proxy')).toHaveCount(1);

    await page.mouse.up();
    // 关键：dragend 收尾。缺了它页面会永久停在拖拽态（源项透明、代理想钉在页面上）
    await expect(page.locator('.shortcut-proxy')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/is-dragging-shortcut/);
    await expect(page.locator('.shortcut-item.dragging-source')).toHaveCount(0);
    await expect(page.locator('#add-shortcut-btn')).not.toHaveClass(/dragging-trash/);
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(2);
  });
});
