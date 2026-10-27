import { expect, type Page } from '@playwright/test';

/* 1x1 PNG（透明），不同文件名区分 hash（hash = 名|大小|类型|mtime）。 */
export const SMALL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface BgFile {
  name: string;
  mimeType?: string;
  buffer?: Buffer;
}

/** 通过 /settings 页添加背景（可从任意页面调用，不在设置页时先导航过去）。 */
export async function addBgViaSettings(page: Page, files: BgFile[]): Promise<void> {
  if (!page.url().endsWith('/settings')) await page.goto('/settings');
  const fcPromise = page.waitForEvent('filechooser');
  await page.click('#add-bg-btn');
  const fc = await fcPromise;
  await fc.setFiles(
    files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType ?? 'image/png',
      buffer: f.buffer ?? SMALL_PNG,
    })),
  );
}

/** 添加单个背景并等待应用（#bg-layer 出现 1 个媒体元素）。 */
export async function addOneBg(page: Page, name: string): Promise<void> {
  await addBgViaSettings(page, [{ name }]);
  await expect.poll(() => page.locator('#bg-layer img').count(), { timeout: 5000 }).toBe(1);
}
