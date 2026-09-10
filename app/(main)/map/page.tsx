import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapWorkspace } from '@/components/map/MapWorkspace';
import {
  canWritePolygon,
  getMapObjectsGeoJSON,
  getPolygon,
  getPolygonStats,
  listMyPolygons,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ polygon?: string }>;
}) {
  const { polygon: polygonParam } = await searchParams;

  // Если в URL явно указан polygon — открываем его.
  if (polygonParam) {
    const polygon = await getPolygon(polygonParam);
    if (!polygon) {
      return <NotFoundState />;
    }
    const [objects, stats, canWrite] = await Promise.all([
      getMapObjectsGeoJSON(polygon.id),
      getPolygonStats(polygon.id),
      canWritePolygon(polygon.id),
    ]);
    return <MapWorkspace polygon={polygon} objects={objects} stats={stats} canWrite={canWrite} />;
  }

  // Иначе — пытаемся редиректнуть на первый свой участок.
  const my = await listMyPolygons();
  if (my.length > 0) {
    redirect(`/map?polygon=${my[0].id}`);
  }
  const shared = await listSharedWithMePolygons();
  if (shared.length > 0) {
    redirect(`/map?polygon=${shared[0].id}`);
  }
  const publicPolys = await listPublicPolygons();
  if (publicPolys.length > 0) {
    redirect(`/map?polygon=${publicPolys[0].id}`);
  }

  return <EmptyState />;
}

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">У вас пока нет участков</h2>
        <p className="mt-2 text-sm text-gray-500">
          Участок — территория, где вы работаете: полигон учебных практик, район экспедиции, лесная
          делянка. Обведите границу на карте и начните добавлять скважины.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/polygons/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
          >
            Создать первый участок
          </Link>
          <Link href="/polygons" className="text-sm text-header hover:underline">
            Посмотреть публичные участки
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
        Участок не найден или у вас нет к нему доступа.{' '}
        <Link href="/polygons" className="font-medium underline">
          Открыть список участков
        </Link>
      </div>
    </div>
  );
}
