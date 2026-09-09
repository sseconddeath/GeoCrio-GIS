import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObservationPointForm } from '@/components/forms/ObservationPointForm';
import { getObservationPointFeature } from '@/lib/supabase/queries';

export default async function EditObservationPointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feature = await getObservationPointFeature(id);
  if (!feature) notFound();

  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <Link href={`/observation-points/${id}`} className="text-sm text-header hover:underline">
        ← К профилю
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Редактирование точки наблюдения</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <ObservationPointForm
          polygonId={p.polygon_id}
          point={{ ...p, lng, lat }}
        />
      </div>
    </div>
  );
}
