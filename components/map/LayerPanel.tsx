'use client';

import { COLORS } from '@/lib/constants';
import type { PolygonStatsRow } from '@/lib/supabase/types';

export interface LayerVisibility {
  boreholes: boolean;
  observationPoints: boolean;
  polygonBoundary: boolean;
}

interface LayerPanelProps {
  polygonName: string;
  stats: PolygonStatsRow | null;
  visibility: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
}

// Занимает Sidebar (240px, hidden lg:block). Три чекбокса и легенда цветов.
export function LayerPanel({ polygonName, stats, visibility, onToggle }: LayerPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Полигон</div>
        <div className="mt-1 truncate text-sm font-semibold text-gray-900" title={polygonName}>
          {polygonName}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Слои</div>
        <ul className="mt-2 flex flex-col gap-2">
          <li>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={visibility.boreholes}
                onChange={() => onToggle('boreholes')}
                className="h-4 w-4"
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS.borehole }}
                aria-hidden
              />
              Скважины
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={visibility.observationPoints}
                onChange={() => onToggle('observationPoints')}
                className="h-4 w-4"
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS.observationPoint }}
                aria-hidden
              />
              Точки наблюдений
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={visibility.polygonBoundary}
                onChange={() => onToggle('polygonBoundary')}
                className="h-4 w-4"
              />
              <span
                className="inline-block h-2.5 w-2.5 border-t-2 border-dashed"
                style={{ borderColor: COLORS.header }}
                aria-hidden
              />
              Граница полигона
            </label>
          </li>
        </ul>
      </div>

      {stats ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Статистика</div>
          <dl className="mt-2 space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <dt>Скважины</dt>
              <dd className="font-medium">{stats.borehole_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Точки наблюдений</dt>
              <dd className="font-medium">{stats.obs_point_count}</dd>
            </div>
          </dl>
          {/* Замеры и фото пока не заводятся из UI (появятся в следующих
              версиях, см. дорожную карту). Скрываем счётчики, чтобы «0/0»
              не выглядели как поломка. */}
        </div>
      ) : null}

      <div className="mt-auto text-xs text-gray-400">
        <p>Клик по карте — добавить объект.</p>
        <p>Клик по маркеру — детали.</p>
      </div>
    </div>
  );
}
