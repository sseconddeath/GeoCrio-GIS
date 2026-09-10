import { AlertTriangle, ArrowRight, Compass, MapPinned, Plus } from 'lucide-react';
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
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-header/10">
          <MapPinned size={32} className="text-header" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">
          У вас пока нет участков
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Участок — территория, где вы работаете: полигон учебных практик, район экспедиции, лесная
          делянка. Обведите границу на карте и начните добавлять скважины.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/polygons/new"
            className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-header px-5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-header/90 hover:shadow-md active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden />
            Создать первый участок
          </Link>
          <Link
            href="/polygons"
            className="inline-flex items-center justify-center gap-1.5 text-sm text-header hover:underline"
          >
            <Compass size={14} aria-hidden />
            Посмотреть публичные участки
            <ArrowRight
              size={14}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle size={22} className="text-red-600" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-sm text-red-900">
          Участок не найден или у вас нет к нему доступа.
        </p>
        <Link
          href="/polygons"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline"
        >
          Открыть список участков
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
