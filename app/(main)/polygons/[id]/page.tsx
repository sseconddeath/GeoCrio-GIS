import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  canWritePolygon,
  getPolygon,
  getPolygonStats,
  isPolygonOwner,
} from '@/lib/supabase/queries';

export default async function PolygonOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const polygon = await getPolygon(id);
  if (!polygon) notFound();

  const [stats, canWrite, isOwner] = await Promise.all([
    getPolygonStats(polygon.id),
    canWritePolygon(polygon.id),
    isPolygonOwner(polygon.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/polygons" className="text-sm text-header hover:underline">
        ← К списку участков
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-gray-900">{polygon.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 font-medium uppercase tracking-wide ${
                polygon.is_public
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {polygon.is_public ? 'публичный' : 'приватный'}
            </span>
            <span className="text-gray-400">
              Создан {new Date(polygon.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>

      {polygon.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{polygon.description}</p>
      ) : null}

      {stats ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Скважины" value={stats.borehole_count} />
          <StatTile label="Точки" value={stats.obs_point_count} />
          <StatTile label="Замеры" value={stats.measurement_count} disabled />
          <StatTile label="Фото" value={stats.photo_count} disabled />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/map?polygon=${polygon.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          Открыть на карте
        </Link>
        <Link
          href={`/data?polygon=${polygon.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-5 text-sm font-medium text-header hover:bg-gray-50"
        >
          Таблица объектов
        </Link>
        {canWrite ? (
          <Link
            href={`/polygons/${polygon.id}/edit`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-5 text-sm font-medium text-header hover:bg-gray-50"
          >
            Редактировать границу
          </Link>
        ) : null}
        {isOwner ? (
          <Link
            href={`/polygons/${polygon.id}/settings`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-5 text-sm font-medium text-header hover:bg-gray-50"
          >
            Настройки и команда
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  disabled = false,
}: {
  label: string;
  value: number;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        disabled ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
        {value}
      </div>
      {disabled ? (
        <div className="mt-1 text-[10px] text-gray-400">появится в следующих версиях</div>
      ) : null}
    </div>
  );
}
