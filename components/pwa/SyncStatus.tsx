'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { countPending, drain, subscribeQueue } from '@/lib/offline/queue';

// Индикатор состояния очереди офлайн-мутаций. Крепится в шапке рядом с
// пользовательским меню.
//
// Показывает: N изменений ждут отправки. Клик — принудительный drain
// (полезно, если Wi-Fi вроде появился, но автосинхрон не запустился).
// При успешном дренe вызывает router.refresh() — свежие данные
// подтягиваются со Server Components.
//
// Триггеры автодрейна:
//  - монтирование (свежий заход в приложение)
//  - событие window online
//  - изменение очереди (после enqueue из формы)
//  - каждые 60 секунд как страховка

export function SyncStatus() {
  const [count, setCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const refreshCount = async () => {
      try {
        const n = await countPending();
        if (!cancelled) setCount(n);
      } catch {
        // IDB может быть недоступен (Safari private mode) — тихо.
      }
    };

    const tryDrain = () => {
      startTransition(async () => {
        try {
          const report = await drain();
          if (report.processed > 0) router.refresh();
          if (report.failed > 0 && !report.networkStopped) {
            setLastError(`Не удалось отправить ${report.failed} — проверьте очередь`);
          } else {
            setLastError(null);
          }
        } catch (err) {
          setLastError(err instanceof Error ? err.message : String(err));
        }
        await refreshCount();
      });
    };

    refreshCount();
    tryDrain();

    const unsubscribe = subscribeQueue(refreshCount);
    const onOnline = () => tryDrain();
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) tryDrain();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [router]);

  if (count === 0 && !pending && !lastError) return null;

  const label = pending
    ? 'Синхронизирую…'
    : count > 0
      ? `Ждут отправки: ${count}`
      : lastError
        ? 'Ошибка синхронизации'
        : '';

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const report = await drain();
          if (report.processed > 0) router.refresh();
          setLastError(
            report.failed > 0 && !report.networkStopped
              ? `Не удалось отправить ${report.failed}`
              : null,
          );
        });
      }}
      className={`inline-flex min-h-[32px] items-center gap-2 rounded-full px-3 text-xs font-medium ${
        lastError && !pending
          ? 'bg-red-100 text-red-800 hover:bg-red-200'
          : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
      }`}
      title={lastError ?? 'Клик — попробовать отправить сейчас'}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        •
      </span>
      <span>{label}</span>
    </button>
  );
}
