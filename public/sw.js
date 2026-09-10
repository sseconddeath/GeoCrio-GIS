// ГеоКрио ГИС — Service Worker.
//
// Задача: чтобы приложение хоть как-то работало в поле без интернета.
// Кэшируем три вещи:
//  1. Плитки OSM (tile.openstreetmap.org) — cache-first, ограничение на
//     количество записей (LRU-подобное — при переполнении удаляем самые
//     старые). Именно это позволяет геологу открыть уже виденную
//     область карты без сети.
//  2. Статику Next.js (/_next/static/*) — cache-first, immutable по
//     хешу в имени.
//  3. Иконки и manifest.
//
// Что не кэшируем: HTML, RSC-запросы, Server Actions, Supabase — это
// живые данные, оставляем Next.js обрабатывать через experimental.useOffline
// (auto-retry) + мы показываем OfflineBanner.
//
// Bump SW_VERSION при breaking-изменениях стратегии, чтобы старые кэши
// удалились в activate.

const SW_VERSION = 'v1';
const TILE_CACHE = `geokrio-tiles-${SW_VERSION}`;
const STATIC_CACHE = `geokrio-static-${SW_VERSION}`;
const ASSET_CACHE = `geokrio-assets-${SW_VERSION}`;
const TILE_MAX_ENTRIES = 800;

const sw = self;

sw.addEventListener('install', (event) => {
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const keep = new Set([TILE_CACHE, STATIC_CACHE, ASSET_CACHE]);
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(handleTile(req));
    return;
  }

  if (url.origin === sw.location.origin) {
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(req, STATIC_CACHE));
      return;
    }
    if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
      event.respondWith(cacheFirst(req, ASSET_CACHE));
      return;
    }
  }
  // Всё остальное — не трогаем, отдаёт браузеру → сеть → Next.js.
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// Плитки OSM: cache-first + фоновое обновление, плюс мягкий LRU — раз в
// N вставок отрезаем старые записи, чтобы не разрастаться до гигабайт.
async function handleTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Обновляем в фоне, чтобы кэш не устаревал совсем — но не ждём.
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {});
          trimCache(TILE_CACHE, TILE_MAX_ENTRIES).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
      trimCache(TILE_CACHE, TILE_MAX_ENTRIES).catch(() => {});
    }
    return response;
  } catch {
    // Офлайн и плитки нет в кэше — Response 504, MapLibre покажет пусто.
    return new Response('', { status: 504, statusText: 'Offline (no cached tile)' });
  }
}

// FIFO по порядку добавления (первые ключи Cache — самые старые записи).
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

// ============================================================================
// Web Push уведомления
// ============================================================================
//
// Приходит push от нашего сервера (lib/push.ts) с JSON-пейлоадом
// {title, body, url?, tag?}. Показываем нативное уведомление; клик
// открывает /inbox или указанный url в существующей вкладке
// приложения (или создаёт новую, если приложение закрыто).

sw.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'ГеоКрио', body: event.data.text() };
  }
  event.waitUntil(
    sw.registration.showNotification(payload.title ?? 'ГеоКрио', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url ?? '/inbox' },
    }),
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/inbox';
  event.waitUntil(
    (async () => {
      const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = all.find((c) => new URL(c.url).origin === sw.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(targetUrl).catch(() => {});
      }
      return sw.clients.openWindow(targetUrl);
    })(),
  );
});
