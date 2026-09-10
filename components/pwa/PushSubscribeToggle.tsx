'use client';

import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import {
  deleteSubscriptionAction,
  saveSubscriptionAction,
} from '@/app/(main)/push/actions';

// Кнопка подписки на push-уведомления. Определяет текущее состояние
// (уже подписан / нет / браузер не поддерживает), даёт включить или
// отключить. Пишет subscription в БД через Server Action.
//
// Требует NEXT_PUBLIC_VAPID_PUBLIC_KEY в env — если его нет,
// кнопка объясняет и не пытается subscribe.
//
// На iOS работает только когда PWA установлена как приложение на
// главный экран (ограничение Apple, не наше).

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = 'checking' | 'unsupported' | 'no-vapid' | 'idle' | 'subscribed';

export function PushSubscribeToggle() {
  const [state, setState] = useState<State>('checking');
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    // Через микротаск — ESLint react-hooks/set-state-in-effect
    // ругается на синхронный setState в теле effect. Ставим в очередь.
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }
      if (!VAPID_PUBLIC) {
        setState('no-vapid');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setState(existing ? 'subscribed' : 'idle');
      } catch {
        if (!cancelled) setState('idle');
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const subscribe = () => {
    if (!VAPID_PUBLIC) return;
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast({ kind: 'error', message: 'Разрешение на уведомления не выдано.' });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast: TS DOM-типизация PushManager.subscribe требует
          // BufferSource с ArrayBuffer (не SharedArrayBuffer). Наш
          // Uint8Array — на обычном ArrayBuffer, но TS не сужает
          // тип автоматически в strict-режиме.
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        });
        const raw = sub.toJSON();
        const result = await saveSubscriptionAction({
          endpoint: sub.endpoint,
          p256dh: raw.keys?.p256dh ?? '',
          auth: raw.keys?.auth ?? '',
          userAgent: navigator.userAgent,
        });
        if (result.ok) {
          setState('subscribed');
          showToast({ kind: 'success', message: 'Уведомления включены.' });
        } else {
          showToast({ kind: 'error', message: result.error ?? 'Не удалось подписаться' });
        }
      } catch (err) {
        showToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Не удалось подписаться',
        });
      }
    });
  };

  const unsubscribe = () => {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setState('idle');
          return;
        }
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await deleteSubscriptionAction(endpoint);
        setState('idle');
        showToast({ kind: 'success', message: 'Уведомления отключены.' });
      } catch (err) {
        showToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Не удалось отключить',
        });
      }
    });
  };

  if (state === 'checking') return null;

  if (state === 'unsupported') {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-600">
        Ваш браузер не поддерживает push-уведомления. На iPhone установите приложение с главного
        экрана (Safari → «Поделиться → На экран Домой»), тогда уведомления заработают.
      </div>
    );
  }

  if (state === 'no-vapid') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Уведомления пока не настроены администратором приложения (нет VAPID-ключа).
      </div>
    );
  }

  if (state === 'subscribed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-green-700">Уведомления включены на этом устройстве</span>
        <button
          type="button"
          onClick={unsubscribe}
          disabled={pending}
          className="inline-flex min-h-[36px] items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Отключить
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-gray-700">
        Получать пуш-уведомления о правках ваших объектов
      </span>
      <button
        type="button"
        onClick={subscribe}
        disabled={pending}
        className="inline-flex min-h-[36px] items-center rounded-md bg-header px-4 text-sm font-medium text-white hover:bg-header/90 disabled:opacity-50"
      >
        {pending ? 'Подписываюсь…' : 'Включить уведомления'}
      </button>
    </div>
  );
}

// Стандартный конвертер URL-safe base64 → Uint8Array для VAPID.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
