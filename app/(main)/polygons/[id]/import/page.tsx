import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CsvImportForm } from '@/components/polygons/CsvImportForm';
import { canWritePolygon, getPolygon } from '@/lib/supabase/queries';

export default async function PolygonImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const polygon = await getPolygon(id);
  if (!polygon) notFound();
  const canWrite = await canWritePolygon(id);
  if (!canWrite) redirect(`/polygons/${id}`);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Импорт</div>
      <h1 className="text-2xl font-semibold text-gray-900">{polygon.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Массовая загрузка скважин или точек наблюдений из CSV-таблицы. Не пропускает точки за
        пределами участка (+500 м буфер) и точки с несуществующим типом грунта / точки.
      </p>

      <div className="mt-6">
        <CsvImportForm polygonId={id} />
      </div>

      <div className="mt-8 text-sm">
        <Link href={`/polygons/${id}`} className="text-header hover:underline">
          ← К участку
        </Link>
      </div>
    </div>
  );
}
