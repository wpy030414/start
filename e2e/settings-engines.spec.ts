import { expect, test } from '@playwright/test';

// 说明：/favicon.ico 路径的请求走浏览器 favicon 专用通道，page.route 无法拦截，
// 故属性断言依赖「img 挂载后失败仅隐藏不卸载」的实现；回退用例用合成 error 事件驱动。

test.describe('设置页搜索引擎', () => {
  test('替换引擎槽位并持久化', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.engine-slot')).toHaveCount(3);
    await expect(page.locator('.engine-slot[data-slot="0"] .engine-slot-name')).toHaveText('千问');
    await expect(page.locator('.engine-slot[data-slot="0"] .engine-slot-badge')).toHaveText('默认'); // 默认槽位徽章

    await page.selectOption('.engine-slot[data-slot="0"] .engine-select', 'google');
    await expect(page.locator('.engine-slot[data-slot="0"] .engine-slot-name')).toHaveText('谷歌');
    expect(await page.evaluate(() => localStorage.getItem('engines'))).toBe(
      JSON.stringify(['google', 'bing', 'bilibili'])
    );
  });

  test('首页使用替换后的引擎与直连 favicon', async ({ page }) => {
    await page.route('https://www.google.com/search**', r =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>google</body></html>' })
    );
    await page.goto('/settings');
    await page.selectOption('.engine-slot[data-slot="0"] .engine-select', 'google');
    await page.click('#settings-back');
    await expect(page.locator('#search-input')).toBeVisible();

    const btn = page.locator('.engine-btn[data-engine="google"]');
    await expect(btn).toHaveCount(1);
    // favicon 直连目标域名、不经代理，且带 no-referrer（无论实际加载成败，img 常驻 DOM）
    await expect(btn.locator('img.engine-favicon')).toHaveAttribute('src', 'https://www.google.com/favicon.ico');
    await expect(btn.locator('img.engine-favicon')).toHaveAttribute('referrerpolicy', 'no-referrer');

    await page.fill('#search-input', 'hello');
    await btn.click();
    await expect(page).toHaveURL(/https:\/\/www\.google\.com\/search\?q=hello/);
  });

  test('favicon 加载失败回退首字母', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('engines', JSON.stringify(['google', 'bing', 'bilibili']))
    );
    await page.goto('/');
    const btn = page.locator('.engine-btn[data-engine="google"]');
    const img = btn.locator('img.engine-favicon');
    await expect(img).toHaveCount(1);

    // 合成 error 事件触发回退（不依赖真实网络结果）
    await img.dispatchEvent('error');
    await expect(btn.locator('.engine-letter')).toHaveText('谷');
    await expect(img).toBeHidden(); // 隐藏但保持挂载
  });
});
