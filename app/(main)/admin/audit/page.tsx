import { listRecentAudit } from '@/lib/supabase/queries';

const ACTION_LABELS: Record<string, string> = {
  insert: 'создание',
  update: 'изменение',
  delete: 'удаление',
  restore: 'восстановление',
  sync: 'синхронизация',
};

const TABLE_LABELS: Record<string, string> = {
  boreholes: 'Скважина',
  observation_points: 'Точка',
  measurements: 'Замер',
  polygons: 'Участок',
  polygon_members: 'Соавтор',
  photos: 'Фото',
  field_notes: 'Заметка',
  profiles: 'Профиль',
};

export default async function AdminAuditPage() {
  const rows = await listRecentAudit(200);
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Аудит-лог</h1>
      <p className="mt-2 text-sm text-gray-600">
        Последние {rows.length} записей журнала изменений. Полная история конкретного объекта
        показывается на его карточке (секция «История изменений»).
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Время</th>
              <th className="px-3 py-2">Пользователь</th>
              <th className="px-3 py-2">Действие</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">ID записи</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                  {new Date(r.created_at).toLocaleString('ru-RU')}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {r.user_name ?? <span className="text-gray-400">удалён</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-700">
                    {ACTION_LABELS[r.action] ?? r.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {TABLE_LABELS[r.table_name] ?? r.table_name}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{r.record_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">Записей пока нет.</p>
        ) : null}
      </div>
    </div>
  );
}
