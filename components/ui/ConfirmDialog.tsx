'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Модальное подтверждение — замена window.confirm. Разница ради UX:
//  - показывает тип и код объекта в тексте («Удалить скважину Скв-01?»);
//  - на мобилке нормально скроллится и не закрывает всю страницу;
//  - Esc и клик по фону — отмена;
//  - кнопка «Удалить» красная, primary-фокус на «Отменить» (безопаснее
//    случайного Enter).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="confirm-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{description}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex min-h-[36px] items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-header hover:bg-header/90'
            }`}
          >
            {pending ? 'Выполняю…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
