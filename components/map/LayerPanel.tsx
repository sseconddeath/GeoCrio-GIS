'use client';

import { COLORS } from '@/lib/constants';
import type { PolygonStatsRow } from '@/lib/supabase/types';

export interface LayerVisibility {
  boreholes: boolean;
  observationPoints: boolean;
  polygonBoundary: boolean;
}

export type MapColorMode = 'type' | 'permafrost';

interface LayerPanelProps {
  polygonName: string;
  stats: PolygonStatsRow | null;
  visibility: LayerVisibility;
  colorMode: MapColorMode;
  onToggle: (key: keyof LayerVisibility) => void;
  onChangeColorMode: (mode: MapColorMode) => void;
}

// Занимает Sidebar (240px, hidden lg:block). Три чекбокса для видимости
// слоёв, переключатель раскраски маркеров (по типу объекта или по
// статусу мерзлоты — главный визуальный инсайт геокриологии), легенда
// цветов подстраивается под выбранный режим.
export function LayerPanel({
  polygonName,
  stats,
  visibility,
  colorMode,
  onToggle,
  onChangeColorMode,
}: LayerPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
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

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Раскраска маркеров
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="color-mode"
              value="type"
              checked={colorMode === 'type'}
              onChange={() => onChangeColorMode('type')}
              className="h-4 w-4"
            />
            Тип объекта
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="color-mode"
              value="permafrost"
              checked={colorMode === 'permafrost'}
              onChange={() => onChangeColorMode('permafrost')}
              className="h-4 w-4"
            />
            Статус мерзлоты
          </label>
        </div>

        <div className="mt-3 space-y-1.5">
          {colorMode === 'type' ? (
            <>
              <LegendDot color={COLORS.borehole} label="Скважина" />
              <LegendDot color={COLORS.observationPoint} label="Точка наблюдения" />
            </>
          ) : (
            <>
              <LegendDot color={COLORS.permafrost.frozen} label="Мёрзлый (t &lt; −0,5 °C)" />
              <LegendDot color={COLORS.permafrost.transitional} label="Переходный (−0,5…+0,5)" />
              <LegendDot color={COLORS.permafrost.thawed} label="Талый (t &gt; +0,5 °C)" />
              <LegendDot color="#9ca3af" label="Нет замеров" />
            </>
          )}
        </div>
      </div>

      {stats ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Статистика
          </div>
          <dl className="mt-2 space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <dt>Скважины</dt>
              <dd className="font-medium">{stats.borehole_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Точки наблюдений</dt>
              <dd className="font-medium">{stats.obs_point_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Замеры температуры</dt>
              <dd className="font-medium">{stats.measurement_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Фото</dt>
              <dd className="font-medium">{stats.photo_count}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="mt-auto text-xs text-gray-400">
        <p>Клик по маркеру — детали.</p>
        <p>Кнопка + внизу — добавить объект.</p>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      <span
        className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
