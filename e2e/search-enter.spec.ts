import { expect, test, type Page } from '@playwright/test';

const ok = (body: string) => ({ status: 200, contentType: 'text/html', body: `<html><body>${body}</body></html>` });

/** 两个目标站点都兜住：守卫失效时断言靠 URL 变化就能抓到，不必真联网。 */
async function mockEngines(page: Page) {
  await page.route('https://www.bing.com/**', route => route.fulfill(ok('bing')));
  await page.route('https://tongyi.aliyun.com/**', route => route.fulfill(ok('qianwen')));
}

/** 真实 IME 无法在测试里驱动，只能手工派发组合事件（React 监听在 root，bubbles 必需）。 */
function fireComposition(page: Page, type: 'compositionstart' | 'compositionend') {
  return page.evaluate(t => {
    document.getElementById('search-input')!.dispatchEvent(new CompositionEvent(t, { bubbles: true }));
  }, type);
}

/**
 * 派发一个可控的 keydown，复现各浏览器上报输入法上屏的不同信号：
 * Chrome/Firefox 给 isComposing，Safari 可能只给 keyCode 229，或在上屏后补发普通 Enter。
 */
function fireKey(page: Page, key: string, init: { isComposing?: boolean; keyCode?: number } = {}) {
  return page.evaluate(o => {
    const el = document.getElementById('search-input')!;
    const ev = new KeyboardEvent('keydown', {
      key: o.key, code: o.key, bubbles: true, cancelable: true, isComposing: o.isComposing,
    });
    // keyCode 不在 KeyboardEventInit 里（非标准），需要手动覆盖 getter
    if (o.keyCode !== undefined) Object.defineProperty(ev, 'keyCode', { get: () => o.keyCode });
    el.dispatchEvent(ev);
  }, { key, ...init });
}

const fireEnter = (page: Page, init: { isComposing?: boolean; keyCode?: number } = {}) => fireKey(page, 'Enter', init);

/** 等待超过 compositionend 冷却窗口，确认这期间没有发生导航。 */
async function expectStayed(page: Page, url: string) {
  await page.waitForTimeout(300);
  expect(page.url()).toBe(url);
}

test.describe('回车搜索', () => {
  test('输入关键词后按 Enter → 用默认引擎搜索', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('default_engine', '1'));
    await mockEngines(page);
    await page.goto('/');

    await page.fill('#search-input', 'hello world');
    await page.locator('#search-input').press('Enter');
    await expect(page).toHaveURL(/https:\/\/www\.bing\.com\/search\?q=hello(%20|\+)?world/);
  });

  test('输入为空时按 Enter → 进入默认引擎首页', async ({ page }) => {
    await mockEngines(page);
    await page.goto('/');

    await page.locator('#search-input').click();
    await page.locator('#search-input').press('Enter');
    await expect(page).toHaveURL('https://tongyi.aliyun.com/qianwen/');
  });

  test('↑ 翻出历史后按 Enter → 搜索该条', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('default_engine', '1');
      localStorage.setItem('search_history', JSON.stringify([{ q: '翻出来的', engine: 'bing', time: 1 }]));
    });
    await mockEngines(page);
    await page.goto('/');

    const input = page.locator('#search-input');
    await input.click();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('翻出来的');
    await input.press('Enter');
    await expect(page).toHaveURL(/https:\/\/www\.bing\.com\/search\?q=/);
  });
});

test.describe('输入法回车不算搜索', () => {
  test('对照：合成派发的普通 Enter → 正常搜索（守卫不误伤）', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('default_engine', '1'));
    await mockEngines(page);
    await page.goto('/');

    await page.fill('#search-input', 'hello');
    await fireEnter(page, { isComposing: false });
    await expect(page).toHaveURL(/https:\/\/www\.bing\.com\/search\?q=hello$/);
  });

  test('组合中按 Enter（候选上屏）→ 不搜索', async ({ page }) => {
    await mockEngines(page);
    await page.goto('/');
    const url = page.url();

    await page.fill('#search-input', 'nihao');
    await fireComposition(page, 'compositionstart');
    await fireEnter(page, { isComposing: true });
    await expectStayed(page, url);
  });

  test('compositionend 后补发的 Enter（Safari 行为）→ 不搜索', async ({ page }) => {
    await mockEngines(page);
    await page.goto('/');
    const url = page.url();

    await page.fill('#search-input', 'nihao');
    await fireComposition(page, 'compositionstart');
    await fireComposition(page, 'compositionend');
    await fireEnter(page, { isComposing: false });
    await expectStayed(page, url);
  });

  test('只带 keyCode 229 的 Enter → 不搜索', async ({ page }) => {
    await mockEngines(page);
    await page.goto('/');
    const url = page.url();

    await page.fill('#search-input', 'nihao');
    await fireEnter(page, { keyCode: 229 });
    await expectStayed(page, url);
  });

  test('冷却窗口过后再按 Enter → 正常搜索', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('default_engine', '1'));
    await mockEngines(page);
    await page.goto('/');

    await page.fill('#search-input', 'nihao');
    await fireComposition(page, 'compositionstart');
    await fireComposition(page, 'compositionend');
    await page.waitForTimeout(300);
    await page.locator('#search-input').press('Enter');
    await expect(page).toHaveURL(/https:\/\/www\.bing\.com\/search\?q=nihao/);
  });

  test('组合中按 ↑（选候选词）→ 不翻阅历史、不改写输入', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('search_history', JSON.stringify([{ q: '历史条目', engine: 'bing', time: 1 }]))
    );
    await mockEngines(page);
    await page.goto('/');

    const input = page.locator('#search-input');
    await page.fill('#search-input', 'nihao');
    await fireComposition(page, 'compositionstart');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('nihao');
  });
});
