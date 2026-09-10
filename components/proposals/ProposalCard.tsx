'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { EditProposalWithMeta } from '@/lib/supabase/queries';
import {
  acceptProposalAction,
  rejectProposalAction,
  unvoteForProposalAction,
  voteForProposalAction,
  withdrawProposalAction,
} from '@/app/(main)/proposals/actions';

interface ProposalCardProps {
  proposal: EditProposalWithMeta;
  // currentUserId нужен, чтобы понять: я — автор предложения (тогда
  // показываем «Отозвать» вместо «Согласен»).
  currentUserId: string | null;
  // Для inbox — показать заголовок «на объекте X».
  showTargetLink?: boolean;
}

const THRESHOLD = 3;

// Карточка одного предложения. Три ветки UI:
// - автор объекта или админ → «Принять» / «Отклонить»
// - автор предложения → «Отозвать» (без голосования)
// - остальные → «+1 согласен» / «Убрать голос»
// Счётчик голосов и прогресс до порога — рядом с текстом.
export function ProposalCard({ proposal, currentUserId, showTargetLink }: ProposalCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const { showToast } = useToast();

  const isProposer = currentUserId !== null && proposal.proposed_by === currentUserId;
  const isTargetOwner = proposal.can_decide;

  const targetPath =
    proposal.target_table === 'boreholes'
      ? `/boreholes/${proposal.target_id}`
      : `/observation-points/${proposal.target_id}`;

  const onVote = () => {
    startTransition(async () => {
      const result = proposal.my_vote
        ? await unvoteForProposalAction(proposal.id)
        : await voteForProposalAction(proposal.id);
      if (result.ok) {
        showToast({
          kind: 'success',
          message: proposal.my_vote ? 'Голос отозван.' : 'Ваш голос учтён.',
        });
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось' });
      }
    });
  };

  const onAccept = () => {
    startTransition(async () => {
      const result = await acceptProposalAction(
        proposal.id,
        proposal.target_table,
        proposal.target_id,
      );
      if (result.ok) {
        showToast({ kind: 'success', message: 'Правка применена.' });
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось' });
      }
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const result = await rejectProposalAction(
        proposal.id,
        rejectNote.trim() || null,
        proposal.target_table,
        proposal.target_id,
      );
      if (result.ok) {
        showToast({ kind: 'success', message: 'Предложение отклонено.' });
        setRejectOpen(false);
        setRejectNote('');
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось' });
      }
    });
  };

  const onWithdraw = () => {
    startTransition(async () => {
      const result = await withdrawProposalAction(
        proposal.id,
        proposal.target_table,
        proposal.target_id,
      );
      if (result.ok) {
        showToast({ kind: 'success', message: 'Предложение отозвано.' });
        router.refresh();
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось' });
      }
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-gray-900">
          {proposal.proposer_name ?? 'Пользователь удалён'} предлагает изменение
          {showTargetLink && proposal.target_code ? (
            <>
              {' '}на{' '}
              <a href={targetPath} className="text-header hover:underline">
                {proposal.target_code}
              </a>
            </>
          ) : null}
        </div>
        <time className="text-xs text-gray-500" dateTime={proposal.created_at}>
          {new Date(proposal.created_at).toLocaleString('ru-RU')}
        </time>
      </div>

      <p className="mt-1 text-sm text-gray-700">{proposal.reason}</p>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {Object.entries(proposal.proposed_data).map(([key, value]) => (
          <div key={key} className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
            <dt className="text-[10px] uppercase tracking-wide text-gray-500">
              {fieldLabel(proposal.target_table, key)}
            </dt>
            <dd className="text-gray-900">
              {value === '' ? <span className="text-gray-400">(очистить)</span> : value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-600">
          Голосов: <strong>{proposal.votes_count}</strong> / {THRESHOLD}
          {proposal.votes_count >= THRESHOLD ? (
            <span className="ml-2 text-green-700">— применится сообществом</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isTargetOwner ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={pending}
                className="inline-flex min-h-[36px] items-center rounded-md bg-header px-3 text-xs font-medium text-white hover:bg-header/90 disabled:opacity-50"
              >
                Принять
              </button>
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={pending}
                className="inline-flex min-h-[36px] items-center rounded-md border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Отклонить
              </button>
            </>
          ) : isProposer ? (
            <button
              type="button"
              onClick={onWithdraw}
              disabled={pending}
              className="inline-flex min-h-[36px] items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Отозвать
            </button>
          ) : currentUserId ? (
            <button
              type="button"
              onClick={onVote}
              disabled={pending}
              className={`inline-flex min-h-[36px] items-center rounded-md px-3 text-xs font-medium disabled:opacity-50 ${
                proposal.my_vote
                  ? 'bg-header text-white hover:bg-header/90'
                  : 'border border-header/40 bg-white text-header hover:bg-header/5'
              }`}
            >
              {proposal.my_vote ? '+1 (убрать голос)' : '+1 согласен'}
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title="Отклонить предложение?"
        description="Автор предложения увидит статус «отклонено». Можно оставить короткий комментарий — по желанию."
        confirmLabel="Отклонить"
        danger
        pending={pending}
        onConfirm={onReject}
        onCancel={() => setRejectOpen(false)}
      />
    </div>
  );
}

function fieldLabel(table: 'boreholes' | 'observation_points', key: string): string {
  const common: Record<string, string> = { code: 'Код', description: 'Описание' };
  if (table === 'boreholes') {
    return { ...common, depth_m: 'Глубина, м', soil_type: 'Тип грунта' }[key] ?? key;
  }
  return { ...common, point_type: 'Тип точки' }[key] ?? key;
}
