'use client';

import { useEffect, useState } from 'react';

// Подсказка «Установить на главный экран».
//
// Chrome/Edge на Android: ловим beforeinstallprompt, показываем свою
// кнопку. По клику вызываем prompt(), после ответа — прячем.
//
// iOS Safari: beforeinstallprompt не поддерживается, PWA ставится
// только через меню «Поделиться → На экран Домой». Показываем инструкцию.
//
// Если приложение уже запущено как PWA (display-mode: standalone) —
// вообще не показываем.
//
// Пользователь может закрыть подсказку — тогда запоминаем в localStorage,
// чтобы больше не мозолила глаза (нажимает раз в жизни).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'hidden' | 'ios' | 'android';

const DISMISS_KEY = 'geokrio-install-dismissed';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<Mode>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !/Windows/.test(ua);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // На iOS событий нет — показываем инструкцию через 3 сек, чтобы не
    // мешать первому знакомству с приложением.
    let iosTimer: number | undefined;
    if (ios) {
      iosTimer = window.setTimeout(() => setMode('ios'), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  if (mode === 'hidden') return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setMode('hidden');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode('hidden');
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-3 shadow-lg md:left-auto md:right-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">Установить ГеоКрио на телефон</div>
          {mode === 'ios' ? (
            <p className="mt-1 text-xs text-gray-600">
              Нажмите «Поделиться» в Safari и выберите «На экран Домой». Тогда приложение будет
              открываться как обычное — во весь экран, без адресной строки.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-600">
              Установите как приложение — иконка на главном экране, полноэкранный режим, работа с
              уже загруженной картой без интернета.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {mode === 'android' && deferred ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-[36px] items-center justify-center rounded-md bg-header px-3 text-xs font-medium text-white hover:bg-header/90"
              >
                Установить
              </button>
            ) : null}
            <a
              href="/install"
              className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-header/40 bg-white px-3 text-xs font-medium text-header hover:bg-header/5"
            >
              Подробнее
            </a>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Скрыть
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Закрыть"
          className="text-xl leading-none text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
    </div>
  );
}
