import { useCallback, useState } from 'react';
import { SHORTCUTS_KEY, MAX_SHORTCUTS } from '../lib/constants';
import { getFaviconUrl, tryFetchTitleAndFavicon } from '../lib/proxy';

export interface Shortcut {
  url: string;
  title: string;
  favicon: string;
}

function loadShortcuts(): Shortcut[] {
  try {
    const raw = localStorage.getItem(SHORTCUTS_KEY);
    const arr = raw ? JSON.parse(raw) || [] : [];
    return arr.slice(0, MAX_SHORTCUTS);
  } catch {
    return [];
  }
}

function save(arr: Shortcut[]) {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(arr));
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts);

  const addShortcut = useCallback(async (rawUrl: string, rawTitle: string) => {
    let url = rawUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    let title = rawTitle.trim();
    let favicon = getFaviconUrl(url);
    if (!title) {
      const fetched = await tryFetchTitleAndFavicon(url);
      title = fetched.title;
      if (fetched.favicon) favicon = fetched.favicon;
    }
    setShortcuts((prev) => {
      const next = [{ url, title: title || '', favicon }, ...prev];
      if (next.length > MAX_SHORTCUTS) next.length = MAX_SHORTCUTS;
      save(next);
      return next;
    });
  }, []);

  const removeShortcut = useCallback((index: number) => {
    setShortcuts((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      save(next);
      return next;
    });
  }, []);

  return { shortcuts, addShortcut, removeShortcut };
}
