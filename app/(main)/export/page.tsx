import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getPolygon,
  getPolygonStats,
  listMyPolygons,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';

// Экспорт по активному участку. Как /data и /analytics — если polygon
// не указан в ?polygon, редиректим на первый доступный. Так пункт
// «Экспорт» в шапке перестаёт быть заглушкой и сразу даёт две кнопки
// скачивания (полигон уже выбран).
export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ polygon?: string }>;
}) {
  const { polygon: polygonParam } = await searchParams;

  if (!polygonParam) {
    const my = await listMyPolygons();
    if (my.length > 0) redirect(`/export?polygon=${my[0].id}`);
    const shared = await listSharedWithMePolygons();
    if (shared.length > 0) redirect(`/export?polygon=${shared[0].id}`);
    const publicPolys = await listPublicPolygons();
    if (publicPolys.length > 0) redirect(`/export?polygon=${publicPolys[0].id}`);
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Экспорт данных</h1>
        <p className="mt-2 text-sm text-gray-500">
          Заведите первый участок или получите доступ к чужому — и здесь появятся ссылки для
          скачивания.
        </p>
        <Link
          href="/polygons/new"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          Создать участок
        </Link>
      </div>
    );
  }

  const [polygon, stats] = await Promise.all([
    getPolygon(polygonParam),
    getPolygonStats(polygonParam),
  ]);
  if (!polygon) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Экспорт</h1>
        <p className="mt-2 text-sm text-gray-500">Участок не найден или недоступен.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Экспорт данных</h1>
      <p className="mt-1 text-sm text-gray-500">{polygon.name}</p>
      <p className="mt-3 text-sm text-gray-600">
        Скачивание всех объектов активного участка одним файлом. Другой участок — через
        переключатель в шапке.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={`/api/export?polygon=${polygon.id}&format=csv`}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-header/40 hover:bg-header/5"
        >
          <div className="text-sm font-medium text-gray-900">CSV для Excel</div>
          <p className="mt-1 text-xs text-gray-600">
            Таблица кода/типа/параметров/даты, UTF-8 с BOM (кириллица открывается без «крокозябр»),
            разделитель точка с запятой.
          </p>
          <div className="mt-2 text-xs font-medium text-header">Скачать CSV →</div>
        </a>
        <a
          href={`/api/export?polygon=${polygon.id}&format=geojson`}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-header/40 hover:bg-header/5"
        >
          <div className="text-sm font-medium text-gray-900">GeoJSON для ГИС</div>
          <p className="mt-1 text-xs text-gray-600">
            Полная геометрия объектов, открывается в QGIS, ArcGIS, Google Earth Pro и других
            ГИС-приложениях.
          </p>
          <div className="mt-2 text-xs font-medium text-header">Скачать GeoJSON →</div>
        </a>
      </div>

      {stats ? (
        <p className="mt-4 text-xs text-gray-500">
          В файле: {stats.borehole_count} скважин + {stats.obs_point_count} точек наблюдений.
        </p>
      ) : null}
    </div>
  );
}
