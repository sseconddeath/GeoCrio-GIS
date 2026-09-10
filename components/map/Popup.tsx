'use client';

import Link from 'next/link';
import { COLORS, PERMAFROST_LABELS, POINT_TYPE_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';
import type { MapObjectProperties } from './MapView';

interface PopupProps {
  feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>;
  onClose: () => void;
  onEdit: () => void;
  // Может ли текущий пользователь редактировать этот объект? Для чужих
  // публичных участков — false, кнопка «Редактировать» тогда скрывается.
  canEdit: boolean;
}

export function Popup({ feature, onClose, onEdit, canEdit }: PopupProps) {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const isBorehole = props.type === 'borehole';
  const profileHref = isBorehole
    ? `/boreholes/${props.id}`
    : `/observation-points/${props.id}`;

  const permafrostColor = props.permafrost_status
    ? (COLORS.permafrost as Record<string, string>)[props.permafrost_status] ?? '#6b7280'
    : '#6b7280';

  return (
    <div className="absolute right-4 top-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {isBorehole ? 'Скважина' : POINT_TYPE_LABELS[props.type as keyof typeof POINT_TYPE_LABELS] ?? 'Объект'}
          </div>
          <div className="font-semibold text-gray-900">{props.name}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Закрыть"
        >
          X
        </button>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Координаты</span>
          <span className="font-mono">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>

        {isBorehole && props.depth_m != null ? (
          <div className="flex justify-between text-gray-600">
            <span>Глубина</span>
            <span>{props.depth_m} м</span>
          </div>
        ) : null}

        {isBorehole && props.soil_type ? (
          <div className="flex justify-between text-gray-600">
            <span>Грунт</span>
            <span>{SOIL_TYPE_LABELS[props.soil_type as keyof typeof SOIL_TYPE_LABELS] ?? props.soil_type}</span>
          </div>
        ) : null}

        {isBorehole && props.last_temperature != null ? (
          <div className="flex justify-between text-gray-600">
            <span>Последняя температура</span>
            <span>{props.last_temperature.toFixed(1)} °C</span>
          </div>
        ) : null}

        {isBorehole ? (
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: permafrostColor }}
              aria-hidden
            />
            <span className="text-xs text-gray-500">
              {PERMAFROST_LABELS[props.permafrost_status as keyof typeof PERMAFROST_LABELS] ?? '—'}
            </span>
          </div>
        ) : null}

        {props.photo_count > 0 ? (
          <div className="text-xs text-gray-500">Фото: {props.photo_count}</div>
        ) : null}
      </div>

      <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
        <Link
          href={profileHref}
          className="flex-1 rounded-md bg-header py-2 text-center text-sm font-medium text-white hover:bg-header/90"
        >
          Профиль
        </Link>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-header hover:bg-gray-50"
          >
            Редактировать
          </button>
        ) : null}
      </div>
    </div>
  );
}
