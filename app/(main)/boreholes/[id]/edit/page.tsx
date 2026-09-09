import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoreholeForm } from '@/components/forms/BoreholeForm';
import { getBoreholeFeature } from '@/lib/supabase/queries';

export default async function EditBoreholePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feature = await getBoreholeFeature(id);
  if (!feature) notFound();

  const b = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <Link href={`/boreholes/${id}`} className="text-sm text-header hover:underline">
        ← К профилю
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Редактирование скважины</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <BoreholeForm
          polygonId={b.polygon_id}
          borehole={{ ...b, lng, lat }}
        />
      </div>
    </div>
  );
}
