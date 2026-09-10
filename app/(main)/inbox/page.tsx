import Link from 'next/link';
import { ProposalList } from '@/components/proposals/ProposalList';
import { listMyInbox } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';

// Мои уведомления — центр правок и обратной связи.
//
// Входящие: чужие pending-предложения по моим объектам (нужно решить).
// Исходящие: мои pending-предложения (жду решения автора или голосов
// сообщества). Отдельно отсеиваем — чтобы автор объекта не голосовал
// за своё, а автор предложения не мешал сам голосованию.
export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const { incoming, outgoing } = await listMyInbox();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Мои уведомления</h1>
      <p className="mt-2 text-sm text-gray-600">
        Предложения правок ваших объектов от других геологов и статусы ваших предложений
        на чужие объекты.
      </p>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Входящие</h2>
          <span className="text-xs text-gray-500">Ждут вашего решения</span>
        </div>
        <ProposalList
          proposals={incoming}
          currentUserId={currentUserId}
          emptyLabel="Новых предложений по вашим объектам нет."
          showTargetLink
        />
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Исходящие</h2>
          <span className="text-xs text-gray-500">
            Ждут решения автора объекта или ≥3 согласных
          </span>
        </div>
        <ProposalList
          proposals={outgoing}
          currentUserId={currentUserId}
          emptyLabel="Вы пока никому ничего не предлагали."
          showTargetLink
        />
      </section>

      <div className="mt-8 text-sm">
        <Link href="/map" className="text-header hover:underline">
          ← На карту
        </Link>
      </div>
    </div>
  );
}
