import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SoftDeleteButton } from '@/components/data/SoftDeleteButton';
import { ObjectHistory } from '@/components/history/ObjectHistory';
import { MeasurementForm } from '@/components/measurements/MeasurementForm';
import { MeasurementList } from '@/components/measurements/MeasurementList';
import { TemperatureProfileChart } from '@/components/measurements/TemperatureProfileChart';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { PhotoUploader } from '@/components/photos/PhotoUploader';
import { COLORS, PERMAFROST_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';
import {
  canWritePolygon,
  getBoreholeFeature,
  getBoreholeTemperatureProfile,
  getProfileById,
  listMeasurementsForBorehole,
  listObjectHistory,
  listPhotosForParent,
} from '@/lib/supabase/queries';
import { softDeleteBoreholeAction } from '../actions';

export default async function BoreholePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feature = await getBoreholeFeature(id);
  if (!feature) notFound();

  const b = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  const [author, canEdit, photos, measurements, profile, history] = await Promise.all([
    getProfileById(b.created_by),
    canWritePolygon(b.polygon_id),
    listPhotosForParent({ kind: 'borehole', id }),
    listMeasurementsForBorehole(id),
    getBoreholeTemperatureProfile(id),
    listObjectHistory('boreholes', id),
  ]);

  const lastMeasurement = measurements[0] ?? null;
  const status = permafrostStatus(lastMeasurement?.temperature_c ?? null);

  const deleteAction = softDeleteBoreholeAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Скважина</div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{b.code}</h1>
        <Link href="/map" className="text-sm text-header hover:underline">
          ← На карту
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Координаты</dt>
          <dd className="mt-1 font-mono text-sm text-gray-900">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Глубина</dt>
          <dd className="mt-1 text-sm text-gray-900">{b.depth_m != null ? `${b.depth_m} м` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Тип грунта</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {b.soil_type ? SOIL_TYPE_LABELS[b.soil_type] ?? b.soil_type : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Автор</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {author?.full_name ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Создана</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {new Date(b.created_at).toLocaleString('ru-RU')}
          </dd>
        </div>
        {b.updated_at && b.updated_at !== b.created_at ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Изменена</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(b.updated_at).toLocaleString('ru-RU')}
            </dd>
          </div>
        ) : null}
        {b.description ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Описание</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{b.description}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 rounded-full border border-white shadow"
            style={{ backgroundColor: statusColor(status) }}
          />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-gray-500">Статус мерзлоты</div>
            <div className="text-sm font-medium text-gray-900">{PERMAFROST_LABELS[status]}</div>
          </div>
          {lastMeasurement ? (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">Последний замер</div>
              <div className="font-mono text-sm text-gray-900">
                {formatT(lastMeasurement.temperature_c)} · {lastMeasurement.depth_m} м
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Температурные замеры</h2>
        <TemperatureProfileChart profile={profile} />
        <MeasurementList
          boreholeId={id}
          measurements={measurements}
          canEdit={canEdit}
        />
        {canEdit ? <MeasurementForm boreholeId={id} /> : null}
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Фото</h2>
        <PhotoGallery photos={photos} parent={{ kind: 'borehole', id }} canEdit={canEdit} />
        {canEdit ? <PhotoUploader parent={{ kind: 'borehole', id }} /> : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">История изменений</h2>
        <ObjectHistory
          history={history}
          displayFields={{
            code: 'Код',
            depth_m: 'Глубина, м',
            soil_type: 'Тип грунта',
            description: 'Описание',
            is_deleted: 'Удалена',
          }}
        />
      </section>

      {canEdit ? (
        <div className="mt-6 flex gap-3">
          <Link
            href={`/boreholes/${id}/edit`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
          >
            Редактировать
          </Link>
          <SoftDeleteButton
            action={deleteAction}
            title={`Удалить скважину ${b.code}?`}
            description="Скважина и все её замеры и фото исчезнут с карты и списков. Восстановить можно в разделе «Корзина» в течение 30 дней."
          />
        </div>
      ) : (
        <p className="mt-6 text-xs text-gray-500">
          Редактировать эту скважину может только команда участка.
        </p>
      )}
    </div>
  );
}

// Вычисление статуса мерзлоты по последнему замеру — та же логика, что
// в БД-view map_objects: <-0.5 = мёрзлый, >+0.5 = талый, между —
// переходный. null → unknown.
function permafrostStatus(t: number | null): 'frozen' | 'thawed' | 'transitional' | 'unknown' {
  if (t === null) return 'unknown';
  if (t < -0.5) return 'frozen';
  if (t > 0.5) return 'thawed';
  return 'transitional';
}

function statusColor(status: 'frozen' | 'thawed' | 'transitional' | 'unknown'): string {
  if (status === 'frozen') return COLORS.permafrost.frozen;
  if (status === 'thawed') return COLORS.permafrost.thawed;
  if (status === 'transitional') return COLORS.permafrost.transitional;
  return '#9ca3af';
}

function formatT(t: number): string {
  const sign = t > 0 ? '+' : '';
  return `${sign}${t.toFixed(2)} °C`;
}
