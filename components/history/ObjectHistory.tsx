import { COLORS } from '@/lib/constants';
import type { ObjectHistoryEntry } from '@/lib/supabase/queries';

interface ObjectHistoryProps {
  history: ObjectHistoryEntry[];
  // Поля, которые интересно показать в diff. Всё остальное (id,
  // created_at, updated_at, is_deleted, location в EWKT-виде — сырьё,
  // которое читателю ничего не скажет) — скрываем.
  displayFields: Record<string, string>;
}

// Сервер-компонент истории изменений объекта. Читает записи из
// audit_log через RPC fn_object_history (SECURITY DEFINER + проверка
// права чтения полигона). Показывает: кто, когда, действие и — для
// update — только реально изменившиеся поля (before → after).
export function ObjectHistory({ history, displayFields }: ObjectHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
        Записей в истории нет.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {history.map((h) => (
        <li key={h.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <ActionBadge action={h.action} />
              <span className="font-medium text-gray-900">
                {h.user_name ?? 'Пользователь удалён'}
              </span>
            </div>
            <time
              className="text-xs text-gray-500"
              dateTime={h.created_at}
            >
              {formatDate(h.created_at)}
            </time>
          </div>
          <Diff entry={h} displayFields={displayFields} />
        </li>
      ))}
    </ol>
  );
}

function Diff({
  entry,
  displayFields,
}: {
  entry: ObjectHistoryEntry;
  displayFields: Record<string, string>;
}) {
  const before = entry.old_data ?? {};
  const after = entry.new_data ?? {};

  if (entry.action === 'insert') {
    return (
      <p className="mt-2 text-xs text-gray-600">
        Объект создан. Значения:{' '}
        {Object.entries(displayFields)
          .map(([field, label]) => {
            const v = formatValue(after[field]);
            return v === '—' ? null : `${label} = ${v}`;
          })
          .filter(Boolean)
          .join('; ') || '—'}
      </p>
    );
  }

  if (entry.action === 'delete') {
    return <p className="mt-2 text-xs text-gray-600">Объект помечен как удалённый.</p>;
  }

  if (entry.action === 'restore') {
    return <p className="mt-2 text-xs text-gray-600">Объект восстановлен из корзины.</p>;
  }

  // update: показываем только реально изменившиеся поля.
  const rows = Object.entries(displayFields)
    .filter(([field]) => before[field] !== after[field])
    .map(([field, label]) => ({
      label,
      from: formatValue(before[field]),
      to: formatValue(after[field]),
    }));

  if (rows.length === 0) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        Изменения в служебных полях (координаты, метка времени и т.п.).
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-wrap gap-x-2">
          <span className="text-gray-500">{r.label}:</span>
          <span className="line-through text-gray-400">{r.from}</span>
          <span aria-hidden="true" className="text-gray-400">
            →
          </span>
          <span className="font-medium text-gray-900">{r.to}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionBadge({ action }: { action: ObjectHistoryEntry['action'] }) {
  const label =
    action === 'insert'
      ? 'создание'
      : action === 'update'
        ? 'изменение'
        : action === 'delete'
          ? 'удаление'
          : action === 'restore'
            ? 'восстановление'
            : 'синхронизация';
  const color =
    action === 'insert'
      ? '#059669'
      : action === 'delete'
        ? COLORS.permafrost.frozen
        : action === 'restore'
          ? '#0284c7'
          : COLORS.header;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  if (typeof v === 'number') return String(v);
  return String(v);
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
