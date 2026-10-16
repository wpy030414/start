import { expect, test, type Page } from '@playwright/test';

/**
 * 毛玻璃回归哨兵。
 *
 * `backdrop-filter` 只在 `pnpm build` 的产物里会被 CSS 处理管线改写：若同一规则内
 * 手写了标准属性、又在其后手写了值相同的 -webkit- 前缀，这对声明会被折叠成只剩前缀版本，
 * 而 Chromium 并不认识 -webkit-backdrop-filter，毛玻璃于是在线上全线失效。
 * `vite dev` 不做这步处理，所以这类问题只在构建产物中暴露 —— 哨兵必须跑在 preview 上，
 * 断言的是浏览器实际计算值（而非 CSS 文本），改前缀写法或换压缩器都能被它兜住。
 */
async function expectGlass(page: Page, selector: string) {
  const computed = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      // Chromium 只认标准属性，Safari 认前缀版；任一有值即视为这颗玻璃还活着。
      // 用 getPropertyValue 而非驼峰属性：TS 的 CSSStyleDeclaration 未声明 webkitBackdropFilter。
      return (
        cs.getPropertyValue('backdrop-filter') ||
        cs.getPropertyValue('-webkit-backdrop-filter') ||
        'none'
      );
    });
  expect(computed, `${selector} 的毛玻璃在构建产物中失效`).toContain('blur');
}

test.describe('毛玻璃在构建产物中存活', () => {
  test('首页常驻元素', async ({ page }) => {
    await page.goto('/');
    await expectGlass(page, '.search-card-bg');
    await expectGlass(page, '.engine-btn');
    await expectGlass(page, '#help-btn');
  });

  test('帮助气泡', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn');
    await expect(page.locator('#help-popover')).toHaveClass(/open/);
    await expectGlass(page, '#help-popover');
  });

  test('快捷链接弹窗', async ({ page }) => {
    await page.goto('/');
    // webkit 上 goto 后立即派发时 React 的 body 监听器可能尚未挂载，与 shortcuts.spec 同样 poll 重试
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
          );
          return await page.locator('#shortcuts-modal').getAttribute('class');
        },
        { timeout: 5000 }
      )
      .toMatch(/open/);
    await expectGlass(page, '#shortcuts-modal');
    await expectGlass(page, '.modal-panel');
    await expectGlass(page, '.shortcuts-form input');
  });

  test('设置面板', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.settings-panel')).toBeVisible();
    await expectGlass(page, '.settings-panel');
  });

  test('设置页确认弹窗与引擎下拉面板', async ({ page }) => {
    await page.goto('/settings');
    await page.click('#setting-reset');
    await expect(page.locator('#confirm-wipe')).toBeVisible();
    await expectGlass(page, '.modal-panel');
    await page.click('#confirm-dialog-cancel');

    await page.click('.engine-slot[data-slot="0"] .engine-trigger');
    await expect(page.locator('.engine-menu[data-slot="0"]')).toHaveClass(/open/);
    await expectGlass(page, '.engine-menu');
  });
});
