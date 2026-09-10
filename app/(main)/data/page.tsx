import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ObjectsTable } from '@/components/data/ObjectsTable';
import {
  getPolygon,
  listBoreholes,
  listMyPolygons,
  listObservationPoints,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ polygon?: string }>;
}) {
  const { polygon: polygonParam } = await searchParams;

  if (!polygonParam) {
    const my = await listMyPolygons();
    if (my.length > 0) redirect(`/data?polygon=${my[0].id}`);
    const shared = await listSharedWithMePolygons();
    if (shared.length > 0) redirect(`/data?polygon=${shared[0].id}`);
    const publicPolys = await listPublicPolygons();
    if (publicPolys.length > 0) redirect(`/data?polygon=${publicPolys[0].id}`);
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Пока нет данных</h2>
          <p className="mt-2 text-sm text-gray-500">
            Заведите первый участок, чтобы начать добавлять объекты.
          </p>
          <Link
            href="/polygons/new"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
          >
            Создать участок
          </Link>
        </div>
      </div>
    );
  }

  const polygon = await getPolygon(polygonParam);
  if (!polygon) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          Участок не найден.
        </div>
      </div>
    );
  }

  const [boreholes, points] = await Promise.all([
    listBoreholes(polygon.id),
    listObservationPoints(polygon.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Таблица участка</h1>
          <p className="text-sm text-gray-500">{polygon.name}</p>
        </div>
        <Link
          href="/trash"
          className="text-sm text-header hover:underline"
          title="Свои удалённые объекты"
        >
          Корзина
        </Link>
      </div>
      <ObjectsTable boreholes={boreholes} points={points} />
    </div>
  );
}
