import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SoftDeleteButton } from '@/components/data/SoftDeleteButton';
import { PERMAFROST_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';
import { getBoreholeFeature } from '@/lib/supabase/queries';
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

  // Bind id уже здесь — SoftDeleteButton остаётся простым client-компонентом.
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
          <dt className="text-xs uppercase tracking-wide text-gray-500">Создана</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {new Date(b.created_at).toLocaleString('ru-RU')}
          </dd>
        </div>
        {b.description ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Описание</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{b.description}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        <div className="mb-1 inline-block rounded-full bg-header/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-header">
          Этап 5
        </div>
        <p className="mt-2">
          Температурные замеры и профиль по глубине появятся на Этапе 5. Температурный статус
          мерзлоты рассчитывается автоматически по последнему замеру:{' '}
          <span className="font-medium">
            {b.is_deleted ? 'скважина удалена' : PERMAFROST_LABELS.unknown}
          </span>
          .
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href={`/boreholes/${id}/edit`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          Редактировать
        </Link>
        <SoftDeleteButton action={deleteAction} />
      </div>
    </div>
  );
}
