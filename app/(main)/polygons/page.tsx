import Link from 'next/link';
import {
  listMyPolygons,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';
import type { PolygonRow } from '@/lib/supabase/types';

export default async function PolygonsPage() {
  const [my, shared, publicPolys] = await Promise.all([
    listMyPolygons(),
    listSharedWithMePolygons(),
    listPublicPolygons(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Участки</h1>
          <p className="mt-1 text-sm text-gray-500">
            Участок — территория, где вы работаете. Внутри участка вы заводите скважины и точки
            наблюдений.
          </p>
        </div>
        <Link
          href="/polygons/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          + Новый участок
        </Link>
      </div>

      <PolygonSection title="Мои участки" polygons={my} empty="У вас пока нет своих участков. Создайте первый — обведите границу на карте, дайте имя, начните добавлять скважины." />
      <PolygonSection title="Участки, где я соавтор" polygons={shared} empty={null} />
      <PolygonSection
        title="Публичные участки"
        polygons={publicPolys}
        empty="Другие геологи пока не опубликовали свои участки."
      />
    </div>
  );
}

function PolygonSection({
  title,
  polygons,
  empty,
}: {
  title: string;
  polygons: PolygonRow[];
  empty: string | null;
}) {
  if (polygons.length === 0 && empty === null) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      {polygons.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {empty}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {polygons.map((p) => (
            <li key={p.id}>
              <Link
                href={`/polygons/${p.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-header/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{p.name}</div>
                    {p.description ? (
                      <div className="mt-1 line-clamp-2 text-xs text-gray-500">{p.description}</div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      p.is_public ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p.is_public ? 'публ.' : 'приват'}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-gray-400">
                  <span>Создан {new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
