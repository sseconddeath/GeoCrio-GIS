import {
  ArrowUpRight,
  CalendarDays,
  Globe2,
  LayoutGrid,
  Lock,
  Plus,
  Users,
} from 'lucide-react';
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-header/10">
            <LayoutGrid size={22} className="text-header" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Участки</h1>
            <p className="mt-1 text-sm text-gray-500">
              Территория, где вы работаете: полигон практик, район экспедиции, лесная делянка.
            </p>
          </div>
        </div>
        <Link
          href="/polygons/new"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-md bg-header px-5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-header/90 hover:shadow-md active:scale-[0.98]"
        >
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          Новый участок
        </Link>
      </div>

      <PolygonSection
        title="Мои участки"
        icon={<Lock size={14} aria-hidden />}
        polygons={my}
        empty="У вас пока нет своих участков. Создайте первый — обведите границу на карте, дайте имя, начните добавлять скважины."
      />
      <PolygonSection
        title="Участки, где я соавтор"
        icon={<Users size={14} aria-hidden />}
        polygons={shared}
        empty={null}
      />
      <PolygonSection
        title="Публичные участки"
        icon={<Globe2 size={14} aria-hidden />}
        polygons={publicPolys}
        empty="Другие геологи пока не опубликовали свои участки."
      />
    </div>
  );
}

function PolygonSection({
  title,
  icon,
  polygons,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  polygons: PolygonRow[];
  empty: string | null;
}) {
  if (polygons.length === 0 && empty === null) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
        <span className="text-gray-400">{icon}</span>
        {title}
        <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 normal-case tracking-normal">
          {polygons.length}
        </span>
      </h2>
      {polygons.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {empty}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {polygons.map((p) => (
            <li key={p.id}>
              <Link
                href={`/polygons/${p.id}`}
                className="group block rounded-xl border border-gray-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-header/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-gray-900 group-hover:text-header">
                        {p.name}
                      </span>
                      <ArrowUpRight
                        size={14}
                        aria-hidden
                        className="shrink-0 text-gray-300 transition-all duration-150 group-hover:text-header group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </div>
                    {p.description ? (
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
                        {p.description}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      p.is_public
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                        : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                    }`}
                  >
                    {p.is_public ? (
                      <Globe2 size={10} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Lock size={10} strokeWidth={2.5} aria-hidden />
                    )}
                    {p.is_public ? 'публ.' : 'приват'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <CalendarDays size={12} aria-hidden />
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
