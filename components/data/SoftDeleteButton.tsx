'use client';

import { useTransition } from 'react';

interface SoftDeleteButtonProps {
  action: () => Promise<void>;
  label?: string;
  confirmText?: string;
}

// Простая кнопка мягкого удаления с confirm() и pending-состоянием.
// Server Action передаётся из родителя (уже с bind'ом id).
export function SoftDeleteButton({
  action,
  label = 'Удалить',
  confirmText = 'Удалить объект? Его можно будет восстановить.',
}: SoftDeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        startTransition(async () => {
          await action();
        });
      }}
      className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? 'Удаление…' : label}
    </button>
  );
}
