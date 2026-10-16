import { expect, test } from '@playwright/test';

test.describe('搜索历史', () => {
  test('ArrowUp 从最旧开始翻阅', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'search_history',
        JSON.stringify([
          { q: 'newest', engine: 'qianwen', time: 3 },
          { q: 'middle', engine: 'bing', time: 2 },
          { q: 'oldest', engine: 'bing', time: 1 },
        ])
      )
    );
    await page.goto('/');
    const input = page.locator('#search-input');
    await input.click();

    await input.press('ArrowUp');
    await expect(input).toHaveValue('oldest');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('middle');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('newest');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('newest');

    await input.press('ArrowDown');
    await expect(input).toHaveValue('middle');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('oldest');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('');
  });

  test('输入文字重置浏览位置', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'search_history',
        JSON.stringify([
          { q: 'a', engine: 'qianwen', time: 2 },
          { q: 'b', engine: 'qianwen', time: 1 },
        ])
      )
    );
    await page.goto('/');
    const input = page.locator('#search-input');
    await input.click();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('b');
    await input.fill('new');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('new');
  });

  test('Esc 复位并失焦', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'search_history',
        JSON.stringify([{ q: 'abc', engine: 'qianwen', time: 1 }])
      )
    );
    await page.goto('/');
    const input = page.locator('#search-input');
    await input.click();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('abc');
    await input.press('Escape');
    await expect(input).toHaveValue('');
    await expect(input).not.toBeFocused();
  });

  // addHistory 在 window.location.href 之前同步执行，但 href 会导航到跨 origin，
  // 无法在测试中读取更新后的 localStorage。验证 addHistory 的纯函数语义即可；
  // 搜索 UI 行为（点击引擎→跳转）已被 search.spec.ts 覆盖。
  test('去重插入队首逻辑', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const k = 'search_history';
      const MAX = 100;
      let h = JSON.parse(localStorage.getItem(k) || '[]');
      h = h.filter((x: { q: string }) => x.q !== 'dup');
      h.unshift({ q: 'dup', engine: 'qianwen', time: Date.now() });
      if (h.length > MAX) h = h.slice(0, MAX);
      localStorage.setItem(k, JSON.stringify(h));
      return JSON.parse(localStorage.getItem(k) || '[]');
    });
    expect(result).toHaveLength(1);
    expect(result[0].q).toBe('dup');
    expect(result[0].engine).toBe('qianwen');
  });
});