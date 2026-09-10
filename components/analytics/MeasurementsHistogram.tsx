import { COLORS } from '@/lib/constants';
import type { MeasurementsPerDay } from '@/lib/supabase/queries';

interface Props {
  data: MeasurementsPerDay[];
}

// Гистограмма количества замеров по дням за последние 30 дней.
// Пустые дни рисуются как «нулевой» столбец — важно видеть паузы.
export function MeasurementsHistogram({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const W = 640;
  const H = 180;
  const M = { top: 12, right: 8, bottom: 24, left: 32 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const barW = plotW / data.length;

  const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-medium text-gray-900">Замеры за 30 дней</div>
        <div className="text-xs text-gray-500">Всего: {total}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Гистограмма замеров" className="h-auto w-full">
        <line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="#d1d5db" />
        {/* Тики Y (min, mid, max) */}
        {[0, Math.ceil(max / 2), max].map((v, i) => (
          <g key={`y-${i}`}>
            <line
              x1={M.left}
              y1={M.top + plotH - (v / max) * plotH}
              x2={M.left + plotW}
              y2={M.top + plotH - (v / max) * plotH}
              stroke="#f3f4f6"
            />
            <text
              x={M.left - 4}
              y={M.top + plotH - (v / max) * plotH + 3}
              fontSize={10}
              fill="#6b7280"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * plotH;
          const x = M.left + i * barW + barW * 0.15;
          const w = barW * 0.7;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={M.top + plotH - h}
                width={w}
                height={h}
                fill={d.count > 0 ? COLORS.header : '#e5e7eb'}
                rx={1}
              >
                <title>
                  {dateFmt.format(new Date(d.date))}: {d.count}
                </title>
              </rect>
              {/* Подписи только на первом, среднем и последнем дне */}
              {[0, Math.floor(data.length / 2), data.length - 1].includes(i) ? (
                <text
                  x={x + w / 2}
                  y={M.top + plotH + 14}
                  fontSize={10}
                  fill="#6b7280"
                  textAnchor="middle"
                >
                  {dateFmt.format(new Date(d.date))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
