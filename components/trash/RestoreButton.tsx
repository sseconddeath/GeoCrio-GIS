'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import {
  restoreBoreholeAction,
} from '@/app/(main)/boreholes/actions';
import {
  restoreObservationPointAction,
} from '@/app/(main)/observation-points/actions';
import {
  restoreMeasurementAction,
} from '@/app/(main)/measurements/actions';

interface RestoreButtonProps {
  kind: 'borehole' | 'observation_point' | 'measurement';
  id: string;
  parentId?: string;
}

// Мягкое восстановление: is_deleted=false. Server Actions revalidate
// нужные пути; здесь просто вызываем и показываем toast.
export function RestoreButton({ kind, id, parentId }: RestoreButtonProps) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      if (kind === 'borehole') {
        result = await restoreBoreholeAction(id);
      } else if (kind === 'observation_point') {
        result = await restoreObservationPointAction(id);
      } else {
        if (!parentId) {
          showToast({ kind: 'error', message: 'Не найдена родительская скважина замера' });
          return;
        }
        result = await restoreMeasurementAction(id, parentId);
      }
      if (result.ok) {
        showToast({ kind: 'success', message: 'Восстановлено.' });
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось восстановить.' });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-[36px] items-center rounded-md border border-header/40 bg-white px-3 text-sm font-medium text-header hover:bg-header/5 disabled:opacity-50"
    >
      {pending ? 'Восстанавливаю…' : 'Восстановить'}
    </button>
  );
}
