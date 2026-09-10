import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PolygonForm } from '@/components/polygons/PolygonForm';
import { canWritePolygon, getPolygon } from '@/lib/supabase/queries';

export default async function EditPolygonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const polygon = await getPolygon(id);
  if (!polygon) notFound();
  const canWrite = await canWritePolygon(polygon.id);
  if (!canWrite) redirect(`/polygons/${polygon.id}`);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/polygons/${polygon.id}`} className="text-sm text-header hover:underline">
        ← К обзору участка
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Редактирование участка</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <PolygonForm polygon={polygon} />
      </div>
    </div>
  );
}
