'use client';

import { useEffect } from 'react';

// Регистрирует /sw.js. Скрипт SW отдаёт Next.js как статику из public/,
// заголовки для него — в next.config.mjs (no-cache, чтобы клиент всегда
// получал свежий SW и не залипал на старой версии).
//
// Регистрация в useEffect (после гидрации), с проверкой navigator, чтобы
// SSR не падал. Тихо игнорируем ошибку — SW это прогрессивное улучшение,
// приложение обязано работать и без него.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      return;
    }
    const controller = new AbortController();
    // Регистрируем на idle, чтобы не конкурировать за поток с гидрацией.
    const schedule =
      'requestIdleCallback' in window
        ? (fn: () => void) => window.requestIdleCallback(fn)
        : (fn: () => void) => window.setTimeout(fn, 500);
    schedule(() => {
      if (controller.signal.aborted) return;
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          // Тихо — в dev-режиме может ругаться, это ожидаемо.
        });
    });
    return () => controller.abort();
  }, []);
  return null;
}
