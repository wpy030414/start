import { expect, test } from '@playwright/test';

test.describe('三引擎搜索', () => {
  test('默认引擎为千问且高亮', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.engine-btn[data-engine="qianwen"]')).toHaveClass(/active/);
    await expect(page.locator('.engine-btn[data-engine="bing"]')).not.toHaveClass(/active/);
    await expect(page.locator('.engine-btn[data-engine="bilibili"]')).not.toHaveClass(/active/);
  });

  test('点击当前引擎且有输入 → 以该引擎搜索', async ({ page }) => {
    await page.route('https://www.bing.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>bing</body></html>' })
    );
    await page.addInitScript(() => localStorage.setItem('default_engine', 'bing'));
    await page.goto('/');
    await expect(page.locator('.engine-btn[data-engine="bing"]')).toHaveClass(/active/);

    await page.fill('#search-input', 'hello world');
    await page.click('.engine-btn[data-engine="bing"]');
    await expect(page).toHaveURL(/https:\/\/www\.bing\.com\/search\?q=hello(%20|\+)?world/);
  });

  test('点击当前引擎且输入为空 → 进入该引擎首页', async ({ page }) => {
    await page.route('https://tongyi.aliyun.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>qianwen</body></html>' })
    );
    await page.goto('/');
    await page.click('.engine-btn[data-engine="qianwen"]');
    await expect(page).toHaveURL('https://tongyi.aliyun.com/qianwen/');
  });

  test('点击其他引擎 → 仅切换默认引擎并聚焦，不搜索不跳转', async ({ page }) => {
    await page.goto('/');
    const url = page.url();

    await page.click('.engine-btn[data-engine="bilibili"]');
    await expect(page.locator('.engine-btn[data-engine="bilibili"]')).toHaveClass(/active/);
    await expect(page.locator('#search-input')).toBeFocused();
    expect(page.url()).toBe(url);

    const stored = await page.evaluate(() => localStorage.getItem('default_engine'));
    expect(stored).toBe('bilibili');
  });

  test('默认引擎记忆在 localStorage', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('default_engine', 'bilibili'));
    await page.goto('/');
    await expect(page.locator('.engine-btn[data-engine="bilibili"]')).toHaveClass(/active/);
  });
});
