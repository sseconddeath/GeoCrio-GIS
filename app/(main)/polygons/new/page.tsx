import Link from 'next/link';
import { PolygonForm } from '@/components/polygons/PolygonForm';

export default function NewPolygonPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/polygons" className="text-sm text-header hover:underline">
        ← К списку участков
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Новый участок</h1>
      <p className="mt-1 text-sm text-gray-500">
        Обведите границу на карте кликами или загрузите её из файла GeoJSON / KML / GPX. Внутри
        участка вы будете добавлять скважины и точки наблюдений.
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <PolygonForm />
      </div>
    </div>
  );
}
