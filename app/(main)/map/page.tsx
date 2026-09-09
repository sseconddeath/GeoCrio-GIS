import { getActivePolygon, getMapObjectsGeoJSON, getPolygonStats } from '@/lib/supabase/queries';
import { MapWorkspace } from '@/components/map/MapWorkspace';

export default async function MapPage() {
  const polygon = await getActivePolygon();

  if (!polygon) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          Не найден ни один полигон. Запустите миграцию{' '}
          <code className="rounded bg-red-100 px-1">003_seed_polygon.sql</code> или заведите полигон
          вручную через SQL Editor.
        </div>
      </div>
    );
  }

  const [objects, stats] = await Promise.all([
    getMapObjectsGeoJSON(polygon.id),
    getPolygonStats(polygon.id),
  ]);

  return <MapWorkspace polygon={polygon} objects={objects} stats={stats} />;
}
