/* 跨域 URL 抓取与 favicon 解析，一律经反代 https://p.xrl.im/?url=。 */

const PROXY = 'https://p.xrl.im/?url=';

export function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return PROXY + encodeURIComponent(u.origin + '/favicon.ico');
  } catch {
    return '';
  }
}

export function getPageProxyUrl(url: string): string {
  return PROXY + encodeURIComponent(url);
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface FetchedMeta {
  title: string;
  favicon: string;
}

/**
 * 通过反代抓取页面标题与图标链接。
 * 失败时回退到 origin/favicon.ico。
 */
export async function tryFetchTitleAndFavicon(url: string): Promise<FetchedMeta> {
  try {
    const proxyUrl = getPageProxyUrl(url);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { title: '', favicon: getFaviconUrl(url) };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    let favicon = getFaviconUrl(url);
    const linkMatch =
      html.match(/<link[^>]*rel=["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]*>/i);
    if (linkMatch) {
      let raw = linkMatch[1];
      if (raw.startsWith('//')) raw = 'https:' + raw;
      else if (raw.startsWith('/')) raw = new URL(url).origin + raw;
      else if (!/^https?:\/\//i.test(raw)) raw = new URL(url).href.replace(/\/[^/]*$/, '/') + raw;
      favicon = PROXY + encodeURIComponent(raw);
    }
    return { title, favicon };
  } catch {
    return { title: '', favicon: getFaviconUrl(url) };
  }
}
