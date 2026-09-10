import { COLORS } from '@/lib/constants';
import type { BoreholeTemperatureProfileRow } from '@/lib/supabase/types';

interface TemperatureProfileChartProps {
  profile: BoreholeTemperatureProfileRow[];
}

// График T(z) — температура по глубине. Ось Y инвертирована: 0 м —
// сверху (поверхность), глубина растёт вниз, как в геологическом
// разрезе (Bakwin/GTN-P/PermaSAT — везде так рисуют).
//
// Вертикальная линия T=0 °C — граница фазового перехода: слева от неё
// (отрицательная температура) грунт мёрзлый, справа — талый.
//
// Реализация — чистый inline SVG без библиотек: одна виртуальная
// зависимость меньше в бандле, читается и правится напрямую. viewBox
// делает его отзывчивым.
export function TemperatureProfileChart({ profile }: TemperatureProfileChartProps) {
  if (profile.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        Профиль появится, когда будет хотя бы один замер температуры.
      </p>
    );
  }
  if (profile.length === 1) {
    // Одна точка — линию не построить, но показываем текстом.
    const m = profile[0];
    return (
      <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
        Пока один замер: <strong>{formatT(m.temperature_c)}</strong> на глубине{' '}
        <strong>{m.depth_m} м</strong>. График T(z) появится, когда добавите ещё один замер на
        другой глубине.
      </p>
    );
  }

  const points = [...profile].sort((a, b) => a.depth_m - b.depth_m);

  // Диапазоны с запасом на 5% — чтобы точки не липли к рамке.
  const tValues = points.map((p) => p.temperature_c);
  const dValues = points.map((p) => p.depth_m);
  const tMinRaw = Math.min(...tValues, 0);
  const tMaxRaw = Math.max(...tValues, 0);
  const tPad = Math.max(0.5, (tMaxRaw - tMinRaw) * 0.1);
  const tMin = tMinRaw - tPad;
  const tMax = tMaxRaw + tPad;
  const dMin = 0;
  const dMax = Math.max(...dValues) * 1.05;

  // ViewBox в пикселях — CSS растянет на любую ширину.
  const W = 640;
  const H = 360;
  const M = { top: 16, right: 16, bottom: 40, left: 56 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xScale = (t: number) => M.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const yScale = (d: number) => M.top + ((d - dMin) / (dMax - dMin)) * plotH;

  // Тики оси температуры (X) — ~5 значений.
  const xTicks = niceTicks(tMin, tMax, 5);
  // Тики оси глубины (Y).
  const yTicks = niceTicks(dMin, dMax, 5);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.temperature_c)} ${yScale(p.depth_m)}`)
    .join(' ');

  const zeroX = xScale(0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-900">Температура по глубине</div>
        <div className="text-xs text-gray-500">
          Замеров: {points.length} · Глубина: до {dValues[dValues.length - 1]} м
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Профиль температуры по глубине"
        className="h-auto w-full"
      >
        {/* Оси */}
        <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="#d1d5db" />
        <line
          x1={M.left}
          y1={M.top + plotH}
          x2={M.left + plotW}
          y2={M.top + plotH}
          stroke="#d1d5db"
        />

        {/* Сетка + подписи по X */}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line
              x1={xScale(t)}
              y1={M.top}
              x2={xScale(t)}
              y2={M.top + plotH}
              stroke="#f3f4f6"
            />
            <text
              x={xScale(t)}
              y={M.top + plotH + 16}
              fontSize={11}
              fill="#6b7280"
              textAnchor="middle"
            >
              {formatTickT(t)}
            </text>
          </g>
        ))}

        {/* Сетка + подписи по Y */}
        {yTicks.map((d) => (
          <g key={`y-${d}`}>
            <line
              x1={M.left}
              y1={yScale(d)}
              x2={M.left + plotW}
              y2={yScale(d)}
              stroke="#f3f4f6"
            />
            <text
              x={M.left - 6}
              y={yScale(d) + 3}
              fontSize={11}
              fill="#6b7280"
              textAnchor="end"
            >
              {d.toFixed(d < 10 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Ось T=0 °C — граница фазового перехода */}
        {zeroX >= M.left && zeroX <= M.left + plotW ? (
          <>
            <line
              x1={zeroX}
              y1={M.top}
              x2={zeroX}
              y2={M.top + plotH}
              stroke={COLORS.permafrost.frozen}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={zeroX + 4}
              y={M.top + 12}
              fontSize={10}
              fill={COLORS.permafrost.frozen}
            >
              0 °C
            </text>
          </>
        ) : null}

        {/* Линия профиля */}
        <path d={linePath} fill="none" stroke={COLORS.header} strokeWidth={2} />

        {/* Точки — цвет по интерпретации замера */}
        {points.map((p) => (
          <circle
            key={p.depth_m}
            cx={xScale(p.temperature_c)}
            cy={yScale(p.depth_m)}
            r={4.5}
            fill={pointColor(p.temperature_c)}
            stroke="#ffffff"
            strokeWidth={1.5}
          >
            <title>
              {p.depth_m} м, {formatT(p.temperature_c)}
            </title>
          </circle>
        ))}

        {/* Подписи осей */}
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          fontSize={12}
          fill="#374151"
          textAnchor="middle"
        >
          Температура, °C
        </text>
        <text
          x={-M.top - plotH / 2}
          y={14}
          fontSize={12}
          fill="#374151"
          textAnchor="middle"
          transform="rotate(-90)"
        >
          Глубина, м
        </text>
      </svg>
    </div>
  );
}

function pointColor(t: number): string {
  if (t < -0.5) return COLORS.permafrost.frozen;
  if (t > 0.5) return COLORS.permafrost.thawed;
  return COLORS.permafrost.transitional;
}

function formatT(t: number): string {
  const sign = t > 0 ? '+' : '';
  return `${sign}${t.toFixed(2)} °C`;
}

function formatTickT(t: number): string {
  const rounded = Math.round(t * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}`;
}

// Симпатичные «человеческие» тики: делим диапазон на ~n частей, шаг
// округляем до 1/2/5 × 10^k. Классический алгоритм D3-nice-ticks в
// одну функцию.
function niceTicks(min: number, max: number, target: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;

  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    // Убираем накопленную ошибку сложения.
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}
