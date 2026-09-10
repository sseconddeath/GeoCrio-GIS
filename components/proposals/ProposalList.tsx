import { ProposalCard } from './ProposalCard';
import type { EditProposalWithMeta } from '@/lib/supabase/queries';

interface ProposalListProps {
  proposals: EditProposalWithMeta[];
  currentUserId: string | null;
  emptyLabel?: string;
  showTargetLink?: boolean;
}

export function ProposalList({
  proposals,
  currentUserId,
  emptyLabel = 'Ожидающих предложений нет.',
  showTargetLink,
}: ProposalListProps) {
  if (proposals.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          currentUserId={currentUserId}
          showTargetLink={showTargetLink}
        />
      ))}
    </div>
  );
}
