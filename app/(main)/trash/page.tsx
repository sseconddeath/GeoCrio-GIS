import Link from 'next/link';
import { RestoreButton } from '@/components/trash/RestoreButton';
import { listMyTrash, type TrashItem } from '@/lib/supabase/queries';

// Корзина — свои удалённые объекты за всё время. Кнопка «Восстановить»
// снимает флаг is_deleted; объект возвращается на карту и в списки.
// Реальная автоочистка старше 30 дней (Этап 6) — отдельный cron.
export default async function TrashPage() {
  const items = await listMyTrash();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Корзина</h1>
      <p className="mt-2 text-sm text-gray-600">
        Здесь только ваши удалённые скважины, точки и замеры. Пока что срок хранения не
        ограничен — но со временем автоматика будет удалять объекты старше 30 дней.
      </p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          В корзине пусто.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Что</th>
                <th className="px-3 py-2">Обновлено</th>
                <th className="px-3 py-2 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it) => (
                <tr key={`${it.kind}-${it.id}`}>
                  <td className="px-3 py-2 text-gray-600">{kindLabel(it.kind)}</td>
                  <td className="px-3 py-2 text-gray-900">
                    <span className="font-medium">{it.code}</span>
                    {it.parentCode ? (
                      <span className="ml-2 text-xs text-gray-500">из {it.parentCode}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {new Date(it.updated_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RestoreButton kind={it.kind} id={it.id} parentId={it.parentId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm">
        <Link href="/data" className="text-header hover:underline">
          ← К списку данных
        </Link>
      </div>
    </div>
  );
}

function kindLabel(kind: TrashItem['kind']): string {
  if (kind === 'borehole') return 'Скважина';
  if (kind === 'observation_point') return 'Точка';
  return 'Замер';
}
