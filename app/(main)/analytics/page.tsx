import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MeasurementsHistogram } from '@/components/analytics/MeasurementsHistogram';
import { PermafrostBreakdownChart } from '@/components/analytics/PermafrostBreakdownChart';
import {
  getPolygonAnalytics,
  listMyPolygons,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';

// Аналитика по одному участку (?polygon=<id>). Показывает сводку,
// распределение статуса мерзлоты и активность замеров за 30 дней.
// Если участок не выбран — редирект на первый доступный (как /data).
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ polygon?: string }>;
}) {
  const { polygon: polygonParam } = await searchParams;

  if (!polygonParam) {
    const my = await listMyPolygons();
    if (my.length > 0) redirect(`/analytics?polygon=${my[0].id}`);
    const shared = await listSharedWithMePolygons();
    if (shared.length > 0) redirect(`/analytics?polygon=${shared[0].id}`);
    const publicPolys = await listPublicPolygons();
    if (publicPolys.length > 0) redirect(`/analytics?polygon=${publicPolys[0].id}`);
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Аналитика</h1>
        <p className="mt-2 text-sm text-gray-500">
          Заведите первый участок или получите доступ к чужому — и здесь появится сводка.
        </p>
      </div>
    );
  }

  const analytics = await getPolygonAnalytics(polygonParam);
  if (!analytics) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Аналитика</h1>
        <p className="mt-2 text-sm text-gray-500">Участок не найден или недоступен.</p>
        <Link href="/polygons" className="mt-4 inline-block text-sm text-header hover:underline">
          К списку участков
        </Link>
      </div>
    );
  }

  const { polygon, stats, breakdown, measurementsPerDay, avgLastTemp } = analytics;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Аналитика</h1>
          <p className="text-sm text-gray-500">{polygon.name}</p>
        </div>
        <Link href={`/map?polygon=${polygon.id}`} className="text-sm text-header hover:underline">
          Открыть на карте →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Скважины" value={stats?.borehole_count ?? 0} />
        <StatTile label="Точки наблюдений" value={stats?.obs_point_count ?? 0} />
        <StatTile label="Всего замеров" value={stats?.measurement_count ?? 0} />
        <StatTile
          label="Средн. t° (посл.)"
          value={avgLastTemp != null ? formatT(avgLastTemp) : '—'}
        />
      </div>

      <div className="mt-6 space-y-4">
        <PermafrostBreakdownChart breakdown={breakdown} />
        <MeasurementsHistogram data={measurementsPerDay} />
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Данные считаются по текущему участку. Переключить участок — в шапке.
      </p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function formatT(t: number): string {
  const sign = t > 0 ? '+' : '';
  return `${sign}${t.toFixed(1)} °C`;
}
