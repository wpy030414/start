/* Service Worker for the start page
 *
 * Strategy:
 *   - Main document (navigation): stale-while-revalidate with a 24h soft TTL.
 *     Open the page -> serve from cache instantly, refresh in background.
 *     If the network is flaky, just keep serving the cached version.
 *   - Same-origin static assets (cached on first use, refresh afterward).
 *   - Third-party requests / POST etc.: passthrough untouched.
 */

const VERSION = 'v1';
const MAIN_CACHE = `main-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;

// Single well-known cache key for the cached navigation document. We normalize
// all navigations to this key so "/", "/", and "index.html" all hit the same
// entry.
const MAIN_DOC_KEY = '/index.html';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ---------- helpers ---------- */

function isMainNavigation(req) {
  return req.mode === 'navigate';
}

function isSameOrigin(url) {
  return new URL(url).origin === location.origin;
}

async function getCacheTime() {
  try {
    const tx = await openStore();
    return await new Promise((res, rej) => {
      const r = tx.get('cacheMeta', 'mainCachedAt');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return 0;
  }
}

async function setCacheTime(ts) {
  try {
    const tx = await openStore();
    await new Promise((res, rej) => {
      const r = tx.put('cacheMeta', ts, 'mainCachedAt');
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    console.warn('[sw] failed to persist cache time', e);
  }
}

function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sw_main_meta', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cacheMeta')) {
        db.createObjectStore('cacheMeta');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve(db.transaction('cacheMeta', 'readwrite').objectStore('cacheMeta'));
    };
    req.onerror = () => reject(req.error);
  });
}

/* ---------- lifecycle ---------- */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(MAIN_CACHE).then(async cache => {
      for (const url of ['./', 'index.html']) {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && res.ok) {
            // Always store under the same key so lookups are unambiguous.
            await cache.put(MAIN_DOC_KEY, res);
          }
        } catch (err) {
          console.warn('[sw] precache failed for', url, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![MAIN_CACHE, STATIC_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Let non-GET requests (POST, etc.) go straight to the network.
  if (req.method !== 'GET') return;

  if (isMainNavigation(req)) {
    event.respondWith(handleMainNavigation(req));
    return;
  }

  // Same-origin static assets only. Cross-origin goes straight to network.
  if (isSameOrigin(req.url)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
  }
});

/* ---------- strategies ---------- */

async function handleMainNavigation(req) {
  const cache = await caches.open(MAIN_CACHE);
  const cached = await cache.match(MAIN_DOC_KEY, { ignoreVary: true });

  // If the cache is still fresh (< 24h), revalidate in background but never
  // block on it.
  const cachedAt = await getCacheTime();
  const freshEnough = cachedAt && Date.now() - cachedAt < MS_PER_DAY;

  if (freshEnough && cached) {
    eventSafeRefresh(cache);
    return cached;
  }

  // Cache miss or stale: try the network, fall back to cache, fall back to
  // our offline backup if we really have nothing.
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(MAIN_DOC_KEY, res.clone());
      await setCacheTime(Date.now());
      return res;
    }
    throw new Error('non-ok response');
  } catch (err) {
    if (cached) {
      console.warn('[sw] network failed, serving cached main document', err);
      return cached;
    }
    const offline = await cache.match('index.html', { ignoreVary: true });
    if (offline) return offline;
    throw err;
  }
}

function eventSafeRefresh(cache) {
  // Fire-and-forget update. Guard against network failures by swallowing.
  fetch(MAIN_DOC_KEY, { cache: 'no-cache' })
    .then(res => {
      if (res && res.ok) {
        cache.put(MAIN_DOC_KEY, res.clone());
        return setCacheTime(Date.now());
      }
    })
    .catch(err => console.warn('[sw] background refresh failed', err));
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreVary: true });

  const network = fetch(req)
    .then(res => {
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(err => {
      console.warn('[sw] stale-while-revalidate network failed', err);
      return null;
    });

  return cached || (await network);
}
