import { displayRole } from '@/lib/constants';
import { listAllUsersForAdmin } from '@/lib/supabase/queries';

export default async function AdminUsersPage() {
  const users = await listAllUsersForAdmin();
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Пользователи</h1>
      <p className="mt-2 text-sm text-gray-600">
        Все зарегистрированные геологи платформы. Роль admin — модератор (доступ к этой панели);
        роль назначается через SQL Editor Supabase (<code>UPDATE profiles SET role=&apos;admin&apos; WHERE id=...</code>).
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">ФИО</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2 text-right">Своих участков</th>
              <th className="px-3 py-2 text-right">В команде</th>
              <th className="px-3 py-2">Зарегистрирован</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-3 py-2">
                  {u.role === 'admin' ? (
                    <span className="inline-flex items-center rounded-full bg-header/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-header">
                      админ
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">{displayRole(u.role)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-900">{u.polygons_owned}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-700">
                  {u.polygons_member}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {new Date(u.created_at).toLocaleDateString('ru-RU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">Пользователей нет.</p>
        ) : null}
      </div>
    </div>
  );
}
