import { expect, test, type Page } from '@playwright/test';

/**
 * 玻璃回归哨兵（断言浏览器实际计算值，而非 CSS 文本）。
 *
 * 结构契约：接 @glass-sdk/liquid-glass 材质层（`.lg-surface`）的只有这几处 ——
 * 搜索卡 1 + 引擎按钮 3 + 右上角设置 1 + 左上角 + 1 + 每颗快捷链接 1。背景媒体必须待在
 * GlassScene 的 GlassContent 里（折射源）。
 * 库靠 SVG 折射滤镜「过滤内容层」来画玻璃，一旦背景挪出 GlassContent、或者材质层被误铺到别的元素上
 * （多 surface 会让整页内容反复进滤镜），都会静默变形 —— 两种退化都靠这里兜住。
 *
 * 兜底契约：没有 WebGPU 适配器时（CI 的 chromium/webkit 就是），库留下的材质层是全透明的，
 * 这几处外观由手写的 backdrop-filter 撑住，其余玻璃面则始终是手写实现。这条必须继续守着 ——
 * `backdrop-filter` 只在 `pnpm build` 的产物里会被 CSS 处理管线改写：若同一规则内手写了标准属性、
 * 又在其后手写了值相同的 -webkit- 前缀，这对声明会被折叠成只剩前缀版本，而 Chromium 并不认识
 * -webkit-backdrop-filter，毛玻璃于是在线上全线失效。`vite dev` 不做这步处理，所以这类问题
 * 只在构建产物中暴露 —— 哨兵必须跑在 preview 上。
 */

async function glassMode(page: Page): Promise<'css' | 'webgpu'> {
  const mode = await page.locator('html').getAttribute('data-glass');
  return mode === 'webgpu' ? 'webgpu' : 'css';
}

async function backdropFilter(page: Page, selector: string): Promise<string> {
  return page
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
}

async function expectCssGlass(page: Page, selector: string) {
  expect(await backdropFilter(page, selector), `${selector} 的毛玻璃在构建产物中失效`).toContain('blur');
}

test.describe('玻璃在构建产物中存活', () => {
  test('首页：材质层只铺在搜索区 / 角标 / 快捷链接，弹窗与面板保持手写实现', async ({ page }) => {
    await page.goto('/');
    // 模式锚点必须在：降级样式与材质层的交接全靠它
    expect(
      await page.locator('html').getAttribute('data-glass'),
      'html[data-glass] 是两套玻璃的切换锚点，不能为空'
    ).not.toBeNull();

    // GlassContent 外面套着库自己的透明 wrapper（data-glass-blur-host），故不写直接子选择器
    await expect(page.locator('.glass-scene .lg-content')).toHaveCount(1);
    await expect(page.locator('#bg-layer')).toHaveCount(1);

    // 无快捷链接时共 6 颗：搜索卡 1 + 引擎按钮 3 + 设置 1 + 左上角 + 1
    await expect(page.locator('.lg-surface')).toHaveCount(6);
    await expect(page.locator('.lg-surface.search-card-bg')).toHaveCount(1);
    await expect(page.locator('.engine-btn .lg-surface')).toHaveCount(3);
    await expect(page.locator('.settings-btn .lg-surface')).toHaveCount(1);
    await expect(page.locator('.add-btn .lg-surface')).toHaveCount(1);

    // 面板 / 弹窗始终是手写玻璃
    await expect(page.locator('.modal-panel .lg-surface')).toHaveCount(0);
    if ((await glassMode(page)) === 'css') {
      await expectCssGlass(page, '#settings-btn');
      await expectCssGlass(page, '#add-shortcut-btn');
    }
  });

  test('每颗快捷链接也是玻璃面', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('shortcuts', JSON.stringify([
        { url: 'https://a.com', title: 'A', favicon: '' },
        { url: 'https://b.com', title: 'B', favicon: '' },
      ]))
    );
    await page.reload();
    await expect(page.locator('#shortcuts-showcase .shortcut-item')).toHaveCount(2);
    // 6 + 2 颗
    await expect(page.locator('.lg-surface')).toHaveCount(8);
    await expect(page.locator('.shortcut-item .lg-surface')).toHaveCount(2);
    if ((await glassMode(page)) === 'css') await expectCssGlass(page, '.shortcut-item');
  });

  test('搜索区与设置按钮的玻璃随模式切换', async ({ page }) => {
    await page.goto('/');
    if ((await glassMode(page)) === 'css') {
      // 无 WebGPU：手写玻璃撑住，材质层不可见
      await expectCssGlass(page, '.search-card-bg');
      await expectCssGlass(page, '.engine-btn');
      await expectCssGlass(page, '.settings-btn');
      await expectCssGlass(page, '.add-btn');
    } else {
      // 有 WebGPU：材质层接管，手写玻璃必须退场（否则在折射层上再糊一层模糊）
      expect(await backdropFilter(page, '.search-card-bg')).toBe('none');
      expect(await backdropFilter(page, '.engine-btn')).toBe('none');
      expect(await backdropFilter(page, '.settings-btn')).toBe('none');
      expect(await backdropFilter(page, '.add-btn')).toBe('none');
      for (const selector of [
        '.lg-surface.search-card-bg',
        '.engine-btn .lg-surface',
        '.settings-btn .lg-surface',
        '.add-btn .lg-surface',
      ]) {
        const clipPath = await page
          .locator(selector)
          .first()
          .evaluate((el) => (el as HTMLElement).style.clipPath);
        expect(clipPath, `${selector} 没有 clip-path，说明库里没画出玻璃`).not.toBe('');
      }
    }
  });

  test('快捷链接弹窗保持手写玻璃', async ({ page }) => {
    await page.goto('/');
    await page.click('#add-shortcut-btn');
    await expect(page.locator('#shortcuts-modal')).toHaveClass(/open/);
    await expectCssGlass(page, '#shortcuts-modal');
    await expectCssGlass(page, '.modal-panel');
    await expectCssGlass(page, '.shortcuts-form input');
    await expect(page.locator('.modal-panel .lg-surface')).toHaveCount(0);
  });

  test('设置页：面板与确认弹窗保持手写玻璃，且不新增材质层', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.settings-panel')).toBeVisible();
    await expectCssGlass(page, '.settings-panel');
    await expect(page.locator('.settings-panel .lg-surface')).toHaveCount(0);

    await page.click('#setting-reset');
    await expect(page.locator('#confirm-wipe')).toBeVisible();
    await expectCssGlass(page, '.modal-panel');

    await page.click('#confirm-dialog-cancel');

    // 下拉菜单 portal 到 body（在场景之外），保持手写玻璃
    await page.click('.engine-slot[data-slot="0"] .engine-trigger');
    await expect(page.locator('.engine-menu[data-slot="0"]')).toHaveClass(/open/);
    await expectCssGlass(page, '.engine-menu');
  });
});
