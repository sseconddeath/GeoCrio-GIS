import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PolygonMembers } from '@/components/polygons/PolygonMembers';
import { SoftDeleteButton } from '@/components/data/SoftDeleteButton';
import {
  getPolygon,
  getPolygonTeam,
  isPolygonOwner,
} from '@/lib/supabase/queries';
import {
  deletePolygonAction,
  togglePolygonPublicAction,
} from '../../actions';

export default async function PolygonSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const polygon = await getPolygon(id);
  if (!polygon) notFound();

  const canManage = await isPolygonOwner(polygon.id);
  if (!canManage) redirect(`/polygons/${polygon.id}`);

  const team = await getPolygonTeam(polygon.id);

  const polygonId = polygon.id;
  const nextIsPublic = !polygon.is_public;
  const deleteAction = deletePolygonAction.bind(null, polygonId);
  // Обёртка над togglePolygonPublicAction: form action требует Promise<void>,
  // а сам action возвращает { error? } — оборачиваем и результат игнорируем.
  async function toggleAction(): Promise<void> {
    'use server';
    await togglePolygonPublicAction(polygonId, nextIsPublic);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/polygons/${polygon.id}`} className="text-sm text-header hover:underline">
        ← К обзору участка
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        Настройки участка «{polygon.name}»
      </h1>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Публикация</h2>
        <p className="mt-1 text-sm text-gray-500">
          {polygon.is_public
            ? 'Участок опубликован. Все зарегистрированные геологи видят его и объекты в нём (только для чтения).'
            : 'Участок приватный. Виден только вам и приглашённым соавторам.'}
        </p>
        <form action={toggleAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-5 text-sm font-medium text-header hover:bg-gray-50"
          >
            {polygon.is_public ? 'Сделать приватным' : 'Опубликовать'}
          </button>
        </form>
      </section>

      <div className="mt-6">
        <PolygonMembers polygonId={polygon.id} team={team} canManage={canManage} />
      </div>

      <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-semibold text-red-900">Опасная зона</h2>
        <p className="mt-1 text-sm text-red-700">
          Удаление участка удалит и все объекты внутри (скважины, точки, замеры, фото). Это
          необратимо.
        </p>
        <div className="mt-4">
          <SoftDeleteButton
            action={deleteAction}
            label="Удалить участок"
            confirmText={`Удалить участок «${polygon.name}» вместе со всеми объектами? Это НЕЛЬЗЯ отменить.`}
          />
        </div>
      </section>
    </div>
  );
}
