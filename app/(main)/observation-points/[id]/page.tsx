import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SoftDeleteButton } from '@/components/data/SoftDeleteButton';
import { ObjectHistory } from '@/components/history/ObjectHistory';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { PhotoUploader } from '@/components/photos/PhotoUploader';
import { ProposalList } from '@/components/proposals/ProposalList';
import { ProposeEditForm } from '@/components/proposals/ProposeEditForm';
import { POINT_TYPE_LABELS } from '@/lib/constants';
import {
  canWritePolygon,
  getObservationPointFeature,
  getProfileById,
  listObjectHistory,
  listPendingProposalsForObject,
  listPhotosForParent,
} from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';
import { softDeleteObservationPointAction } from '../actions';

export default async function ObservationPointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feature = await getObservationPointFeature(id);
  if (!feature) notFound();

  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const isAuthor = currentUserId !== null && p.created_by === currentUserId;

  const [author, canEdit, photos, history, proposals] = await Promise.all([
    getProfileById(p.created_by),
    canWritePolygon(p.polygon_id),
    listPhotosForParent({ kind: 'observation_point', id }),
    listObjectHistory('observation_points', id),
    listPendingProposalsForObject('observation_points', id),
  ]);
  const deleteAction = softDeleteObservationPointAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Точка наблюдения</div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{p.code}</h1>
        <Link href="/map" className="text-sm text-header hover:underline">
          ← На карту
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Координаты</dt>
          <dd className="mt-1 font-mono text-sm text-gray-900">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Тип</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {POINT_TYPE_LABELS[p.point_type] ?? p.point_type}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Автор</dt>
          <dd className="mt-1 text-sm text-gray-900">{author?.full_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Создана</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {new Date(p.created_at).toLocaleString('ru-RU')}
          </dd>
        </div>
        {p.updated_at && p.updated_at !== p.created_at ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Изменена</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(p.updated_at).toLocaleString('ru-RU')}
            </dd>
          </div>
        ) : null}
        {p.description ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Описание</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{p.description}</dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Фото</h2>
        <PhotoGallery photos={photos} parent={{ kind: 'observation_point', id }} canEdit={canEdit} />
        {canEdit ? <PhotoUploader parent={{ kind: 'observation_point', id }} /> : null}
      </section>

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Предложения правок</h2>
          {!isAuthor && currentUserId ? (
            <ProposeEditForm
              targetTable="observation_points"
              targetId={id}
              polygonId={p.polygon_id}
              current={{
                code: p.code,
                point_type: p.point_type,
                description: p.description,
              }}
            />
          ) : null}
        </div>
        <ProposalList
          proposals={proposals}
          currentUserId={currentUserId}
          emptyLabel={
            isAuthor
              ? 'Никто пока не предложил правок для этой точки.'
              : 'Открытых предложений нет. Заметили ошибку — «Предложить правку» справа.'
          }
        />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">История изменений</h2>
        <ObjectHistory
          history={history}
          displayFields={{
            code: 'Код',
            point_type: 'Тип',
            description: 'Описание',
            is_deleted: 'Удалена',
          }}
        />
      </section>

      {canEdit ? (
        <div className="mt-6 flex gap-3">
          <Link
            href={`/observation-points/${id}/edit`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
          >
            Редактировать
          </Link>
          <SoftDeleteButton
            action={deleteAction}
            title={`Удалить точку наблюдения ${p.code}?`}
            description="Точка и все её фото исчезнут с карты и списков. Восстановить можно в разделе «Корзина» в течение 30 дней."
          />
        </div>
      ) : (
        <p className="mt-6 text-xs text-gray-500">
          Редактировать эту точку может только команда участка.
        </p>
      )}
    </div>
  );
}
