import { expect, test } from '@playwright/test';

test.describe('设置页搜索引擎', () => {
  test('替换引擎槽位为预设并持久化', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.engine-slot')).toHaveCount(3);

    // 第一槽位 (千问→ChatGPT)
    await page.click('.engine-slot[data-slot="0"] .engine-trigger');
    await expect(page.locator('.engine-menu[data-slot="0"]')).toHaveClass(/open/);
    await page.click('.engine-menu[data-slot="0"] .engine-option[data-value="chatgpt"]');
    await expect(page.locator('.engine-slot[data-slot="0"] .engine-trigger-label')).toHaveText('ChatGPT');
    await expect(page.locator('.engine-menu[data-slot="0"]')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => localStorage.getItem('engines'))).toBe(
      JSON.stringify([
        {
          id: 'chatgpt',
          name: 'ChatGPT',
          urlTemplate: 'https://chatgpt.com/?q={q}',
          home: 'https://chatgpt.com/',
        },
        {
          id: 'bing',
          name: '必应',
          urlTemplate: 'https://www.bing.com/search?q={q}',
          home: 'https://www.bing.com/',
        },
        {
          id: 'bilibili',
          name: '哔哩哔哩',
          urlTemplate: 'https://search.bilibili.com/all?keyword={q}',
          home: 'https://www.bilibili.com/',
        },
      ]),
    );
  });

  test('已下线的豆包预设：陈旧 id 回退到槽位默认，而非降级成自定义引擎', async ({ page }) => {
    // 模拟老用户 storage：槽位 0 停在下线前的 doubao
    await page.addInitScript(() =>
      localStorage.setItem(
        'engines',
        JSON.stringify([
          {
            id: 'doubao',
            name: '豆包',
            urlTemplate: 'https://www.doubao.com/chat/?query={q}',
            home: 'https://www.doubao.com/chat/',
          },
          {
            id: 'google',
            name: '谷歌',
            urlTemplate: 'https://www.google.com/search?q={q}',
            home: 'https://www.google.com/',
          },
          {
            id: 'pixiv',
            name: 'pixiv',
            urlTemplate: 'https://www.pixiv.net/tags/{q}/artworks',
            home: 'https://www.pixiv.net/',
          },
        ]),
      ),
    );
    await page.goto('/');

    // 槽位 0 回退为槽位默认（千问），且不是带首字母徽章的自定义引擎
    const first = page.locator('.engine-btn').first();
    await expect(first).toHaveAttribute('data-engine', 'qianwen');
    await expect(first).toHaveAttribute('title', '千问');
    await expect(first.locator('.engine-letter')).toHaveCount(0);
    await expect(page.locator('.engine-btn[data-engine="doubao"]')).toHaveCount(0);

    // 官方源图标已接入：预设引擎一律渲染内置 SVG
    await expect(page.locator('.engine-btn[data-engine="google"] svg')).toHaveCount(1);
    await expect(page.locator('.engine-btn[data-engine="pixiv"] svg')).toHaveCount(1);

    // 设置页同步显示回退后的预设名
    await page.goto('/settings');
    await expect(page.locator('.engine-slot[data-slot="0"] .engine-trigger-label')).toHaveText('千问');
  });

  test('首页使用替换后的引擎', async ({ page }) => {
    // 堵住所有网络导航防止离开页面
    await page.route('https://www.google.com/search**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>google</body></html>',
      }),
    );
    // 槽位 1 需先成为默认引擎，点一次才会发起搜索（非默认引擎的首次点击仅切换）
    await page.addInitScript(() => localStorage.setItem('default_engine', '1'));
    await page.goto('/settings');
    await page.click('.engine-slot[data-slot="1"] .engine-trigger');
    await page.click('.engine-menu[data-slot="1"] .engine-option[data-value="google"]');
    await page.click('#settings-back');
    await expect(page.locator('#search-input')).toBeVisible();

    const btn = page.locator('.engine-btn[data-engine="google"]');
    await expect(btn).toHaveCount(1);

    await page.fill('#search-input', 'hello');
    await btn.click();
    await expect(page).toHaveURL(/https:\/\/www\.google\.com\/search\?q=hello/);
  });

  test('自定义引擎：设置页表单创建 → 首页首字母徽章 + 搜索编码', async ({ page }) => {
    await page.route('https://x.com/search**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>x</body></html>' }),
    );
    await page.goto('/settings');

    // 槽位 2 → 下拉 → 「自定义…」，打开主题化表单而非原生 prompt
    await page.click('.engine-slot[data-slot="2"] .engine-trigger');
    await page.click('.engine-menu[data-slot="2"] .engine-option[data-value="__custom__"]');
    await expect(page.locator('#custom-engine-confirm')).toBeVisible();

    // 空名称被拦下
    await page.click('#custom-engine-confirm');
    await expect(page.locator('#custom-engine-error')).toContainText('名称');

    // 搜索 URL 缺 {q} 占位符同样被拦下（旧 prompt 流程没有这层校验）
    await page.fill('#custom-engine-name', 'X');
    await page.fill('#custom-engine-url', 'https://x.com/search');
    await page.click('#custom-engine-confirm');
    await expect(page.locator('#custom-engine-error')).toContainText('{q}');

    // 补齐后提交
    await page.fill('#custom-engine-url', 'https://x.com/search?q={q}');
    await page.fill('#custom-engine-home', 'https://x.com/');
    await page.click('#custom-engine-confirm');
    await expect(page.locator('.modal-mask.open')).toHaveCount(0);
    await expect(page.locator('.engine-slot[data-slot="2"] .engine-trigger-label')).toHaveText('X（自定义）');

    // 槽位 2 设为默认引擎后，首页单击即搜索
    await page.evaluate(() => localStorage.setItem('default_engine', '2'));
    await page.click('#settings-back');

    const btn = page.locator('.engine-btn[data-engine="custom-2"]');
    await expect(btn).toHaveCount(1);
    await expect(btn.locator('.engine-letter')).toHaveText('X');

    await page.fill('#search-input', 'hello world');
    await btn.click();
    await expect(page).toHaveURL(/https:\/\/x\.com\/search\?q=hello%20world/);
  });
});
