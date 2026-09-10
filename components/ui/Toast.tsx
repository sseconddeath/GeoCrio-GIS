'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Небольшой toast-стек без внешних библиотек. Показывается снизу
// (не мешает мобильному нижнему меню — учтён bottom-24). Автоскрытие
// через 4 секунды по умолчанию.
//
// Использование: `const { showToast } = useToast();`
// showToast({ kind: 'success', message: 'Скважина сохранена' });

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (input: { kind?: ToastKind; message: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    ({ kind = 'info', message, duration = 4000 }: Parameters<ToastContextValue['showToast']>[0]) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              t.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : t.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-gray-200 bg-white text-gray-800'
            }`}
          >
            <span
              aria-hidden
              className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                t.kind === 'success'
                  ? 'bg-green-500'
                  : t.kind === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
              }`}
            />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Закрыть"
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Тихая заглушка на случай, если компонент рендерится вне провайдера
    // (например в тестах). Не роняем приложение.
    return {
      showToast: (input) => {
        if (typeof console !== 'undefined') console.log('[toast]', input.message);
      },
    };
  }
  return ctx;
}

// Единожды показывает toast когда flag становится true — удобно
// подписывать на state.success из useActionState. Автосбрасывает флаг
// через onClear (обычно router.refresh() или локальный reset).
export function useToastOnFlag(flag: boolean, message: string, kind: ToastKind = 'success') {
  const { showToast } = useToast();
  useEffect(() => {
    if (flag) showToast({ kind, message });
  }, [flag, message, kind, showToast]);
}
