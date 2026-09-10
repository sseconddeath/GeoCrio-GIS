import Link from 'next/link';
import { ProposalList } from '@/components/proposals/ProposalList';
import { listMyDecidedProposals, listMyInbox } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/server';

// Мои уведомления — центр правок и обратной связи.
//
// Три секции:
//  - Входящие: чужие pending-предложения по моим объектам (нужно решить).
//  - Исходящие: мои pending-предложения (жду решения автора или голосов).
//  - История: последние 50 решённых (accepted/applied/rejected/withdrawn)
//    в обе стороны — чтобы автор предложения увидел «моё принято/отклонено»,
//    а автор объекта — «что я решил на прошлой неделе».
export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const [{ incoming, outgoing }, history] = await Promise.all([
    listMyInbox(),
    listMyDecidedProposals(),
  ]);

  const totalHistory = history.incoming.length + history.outgoing.length;

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

      {totalHistory > 0 ? (
        <>
          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">История: по моим объектам</h2>
              <span className="text-xs text-gray-500">Последние {history.incoming.length}</span>
            </div>
            <ProposalList
              proposals={history.incoming}
              currentUserId={currentUserId}
              emptyLabel="Пока нет решённых предложений по вашим объектам."
              showTargetLink
            />
          </section>
          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">История: мои предложения</h2>
              <span className="text-xs text-gray-500">Последние {history.outgoing.length}</span>
            </div>
            <ProposalList
              proposals={history.outgoing}
              currentUserId={currentUserId}
              emptyLabel="Пока нет решённых ваших предложений."
              showTargetLink
            />
          </section>
        </>
      ) : null}

      <div className="mt-8 text-sm">
        <Link href="/map" className="text-header hover:underline">
          ← На карту
        </Link>
      </div>
    </div>
  );
}
