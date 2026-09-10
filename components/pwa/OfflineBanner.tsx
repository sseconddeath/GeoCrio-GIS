'use client';

import { useOffline } from 'next/offline';

// Баннер офлайн-состояния. Показывается в самом верху экрана поверх
// шапки. useOffline() из Next 16 надёжнее navigator.onLine — он
// возвращает true и когда браузер говорит offline, и когда сам Next
// поймал fetch-ошибку на навигации/RSC/Server Action.
//
// При офлайне Next держит запросы pending, а как связь вернётся —
// автоматически повторит. Задача баннера — просто сказать пользователю
// «связи нет, работаем как есть».
export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-black shadow"
    >
      <span aria-hidden="true" className="text-sm leading-none">•</span>
      <span>
        Нет связи — карта покажет то, что уже загружалось. Сохранения повторятся, когда сеть
        вернётся.
      </span>
    </div>
  );
}
