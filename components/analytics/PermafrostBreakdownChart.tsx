import { COLORS } from '@/lib/constants';
import type { PermafrostBreakdown } from '@/lib/supabase/queries';

interface Props {
  breakdown: PermafrostBreakdown;
}

const ROWS: Array<{ key: keyof PermafrostBreakdown; label: string; color: string }> = [
  { key: 'frozen', label: 'Мёрзлый (t < −0,5 °C)', color: COLORS.permafrost.frozen },
  { key: 'transitional', label: 'Переходный (−0,5…+0,5)', color: COLORS.permafrost.transitional },
  { key: 'thawed', label: 'Талый (t > +0,5 °C)', color: COLORS.permafrost.thawed },
  { key: 'unknown', label: 'Нет замеров', color: '#9ca3af' },
];

// Горизонтальный bar chart долей статуса мерзлоты по скважинам
// участка. Пропорции — от общего числа скважин (не только с замерами),
// чтобы «нет замеров» показывало реальную неполноту данных.
export function PermafrostBreakdownChart({ breakdown }: Props) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        На участке пока нет скважин.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-sm font-medium text-gray-900">Статус мерзлоты по скважинам</div>
        <div className="text-xs text-gray-500">Всего: {total}</div>
      </div>
      <div className="space-y-2">
        {ROWS.map((row) => {
          const value = breakdown[row.key];
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={row.key} className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="w-56 shrink-0 text-xs text-gray-700">{row.label}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ backgroundColor: row.color, width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-gray-700">
                {value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
