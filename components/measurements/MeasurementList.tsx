'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { COLORS } from '@/lib/constants';
import type { MeasurementRow } from '@/lib/supabase/types';
import { softDeleteMeasurementAction } from '@/app/(main)/measurements/actions';

interface MeasurementListProps {
  boreholeId: string;
  measurements: MeasurementRow[];
  canEdit: boolean;
}

// Табличный список замеров (последние сверху). Цвет плашки —
// сокращённая интерпретация статуса мерзлоты по конкретному замеру.
// Удаление — через ConfirmDialog + toast, а не window.confirm/alert.
export function MeasurementList({ boreholeId, measurements, canEdit }: MeasurementListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<MeasurementRow | null>(null);
  const { showToast } = useToast();

  if (measurements.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        Замеров пока нет. Добавьте первый — тогда карта покажет статус мерзлоты, а профиль
        температуры (T(z)) появится ниже.
      </p>
    );
  }

  const confirmDelete = () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    startTransition(async () => {
      const result = await softDeleteMeasurementAction(id, boreholeId);
      if (result.ok) {
        showToast({ kind: 'success', message: 'Замер удалён — его можно восстановить в Корзине.' });
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось удалить замер.' });
      }
      setConfirmTarget(null);
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Глубина, м</th>
              <th className="px-3 py-2">Температура, °C</th>
              <th className="px-3 py-2">Дата замера</th>
              <th className="px-3 py-2 hidden sm:table-cell">Заметки</th>
              {canEdit ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {measurements.map((m) => {
              const color = temperatureColor(m.temperature_c);
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-mono text-gray-900">{m.depth_m}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 font-mono text-xs"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {formatTemperature(m.temperature_c)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{formatDate(m.measured_at)}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-gray-600">
                    {m.notes ?? <span className="text-gray-400">—</span>}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(m)}
                        disabled={pending}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Удалить замер?"
        description={
          confirmTarget
            ? `Замер ${formatTemperature(confirmTarget.temperature_c)} °C на глубине ${confirmTarget.depth_m} м от ${formatDate(
                confirmTarget.measured_at,
              )}. Данные можно восстановить в Корзине.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function temperatureColor(t: number): string {
  if (t < -0.5) return COLORS.permafrost.frozen;
  if (t > 0.5) return COLORS.permafrost.thawed;
  return COLORS.permafrost.transitional;
}

const numberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function formatTemperature(t: number): string {
  const sign = t > 0 ? '+' : '';
  return `${sign}${numberFormat.format(t)}`;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
