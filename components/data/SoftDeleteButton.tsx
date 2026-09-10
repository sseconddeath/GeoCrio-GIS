'use client';

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface SoftDeleteButtonProps {
  action: () => Promise<void>;
  label?: string;
  title?: string;
  description?: string;
}

// Кнопка мягкого удаления с confirm-модалом (не window.confirm — та
// плохо смотрится на мобилке и не даёт подставить код/тип объекта в
// текст). После удаления объект попадает в корзину — оттуда его можно
// восстановить в течение 30 дней (страница /trash, Этап 5.2).
export function SoftDeleteButton({
  action,
  label = 'Удалить',
  title = 'Удалить объект?',
  description = 'Объект скроется с карты и списков. Его можно восстановить в разделе «Корзина» в течение 30 дней.',
}: SoftDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      try {
        await action();
      } finally {
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Удаление…' : label}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        pending={isPending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
