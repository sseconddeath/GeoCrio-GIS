import { ObjectsTable } from '@/components/data/ObjectsTable';
import {
  getActivePolygon,
  listBoreholes,
  listObservationPoints,
} from '@/lib/supabase/queries';

export default async function DataPage() {
  const polygon = await getActivePolygon();

  if (!polygon) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          Не найден ни один полигон.
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
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Данные полигона</h1>
        <p className="text-sm text-gray-500">{polygon.name}</p>
      </div>
      <ObjectsTable boreholes={boreholes} points={points} />
    </div>
  );
}
