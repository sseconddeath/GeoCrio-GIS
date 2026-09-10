'use client';

import { useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import {
  inviteMemberAction,
  removeMemberAction,
  type InviteActionState,
} from '@/app/(main)/polygons/actions';
import type { PolygonTeam } from '@/lib/supabase/queries';

interface PolygonMembersProps {
  polygonId: string;
  team: PolygonTeam;
  canManage: boolean;
}

const initialState: InviteActionState = {};

export function PolygonMembers({ polygonId, team, canManage }: PolygonMembersProps) {
  const action = inviteMemberAction.bind(null, polygonId);
  const [state, formAction] = useActionState(action, initialState);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900">Команда участка</h2>
      <p className="mt-1 text-sm text-gray-500">
        Соавторы могут добавлять, редактировать и удалять объекты внутри
        участка. Приглашать и убирать соавторов может только владелец.
      </p>

      <ul className="mt-4 divide-y divide-gray-100">
        {team.owner ? (
          <li className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium text-gray-900">{team.owner.full_name}</div>
              <div className="text-xs text-gray-500">Владелец</div>
            </div>
          </li>
        ) : null}
        {team.members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium text-gray-900">
                {m.profile?.full_name ?? '— удалённый пользователь —'}
              </div>
              <div className="text-xs text-gray-500">
                Соавтор с {new Date(m.created_at).toLocaleDateString('ru-RU')}
              </div>
            </div>
            {canManage ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(`Убрать ${m.profile?.full_name ?? 'пользователя'} из команды?`)) {
                    return;
                  }
                  startTransition(async () => {
                    await removeMemberAction(polygonId, m.user_id);
                  });
                }}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Убрать
              </button>
            ) : null}
          </li>
        ))}
        {team.members.length === 0 ? (
          <li className="py-4 text-sm text-gray-400">
            Соавторов пока нет — вы работаете на участке одни.
          </li>
        ) : null}
      </ul>

      {canManage ? (
        <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-6">
          <FormError message={state.error} />
          {state.success ? (
            <div
              role="status"
              className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800"
            >
              {state.success}
            </div>
          ) : null}
          <Input
            label="Email коллеги"
            name="email"
            type="email"
            required
            placeholder="ivanov@example.com"
          />
          <Button type="submit">Пригласить в команду</Button>
        </form>
      ) : null}
    </section>
  );
}
