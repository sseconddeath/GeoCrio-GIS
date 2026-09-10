'use server';

import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import {
  editProposalSchema,
  proposalDataFromInput,
  type EditProposalInput,
} from '@/lib/validation';

export interface EditProposalActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readFormData(fd: FormData): unknown {
  return {
    targetTable: fd.get('targetTable'),
    targetId: fd.get('targetId'),
    polygonId: fd.get('polygonId'),
    reason: fd.get('reason'),
    code: fd.get('code'),
    depth_m: fd.get('depth_m'),
    soil_type: fd.get('soil_type'),
    point_type: fd.get('point_type'),
    description: fd.get('description'),
  };
}

// Создание предложения правки. RLS-политика `ep_insert` в миграции 006
// сама блокирует попытку автора объекта предложить свою же запись.
// Здесь мы просто передаём валидированный payload — сервер вернёт
// осмысленный текст, если RLS отказал.
export async function createEditProposalAction(
  _prev: EditProposalActionState,
  fd: FormData,
): Promise<EditProposalActionState> {
  const parsed = editProposalSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const input: EditProposalInput = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const proposed_data = proposalDataFromInput(input);
  const { error } = await supabase.from('edit_proposals').insert({
    target_table: input.targetTable,
    target_id: input.targetId,
    polygon_id: input.polygonId,
    proposed_by: user.id,
    reason: input.reason,
    proposed_data,
  });
  if (error) return { error: translateDbError(error) };

  revalidatePath(input.targetTable === 'boreholes'
    ? `/boreholes/${input.targetId}`
    : `/observation-points/${input.targetId}`);
  revalidatePath('/inbox');
  return { success: true };
}

// Голос «+1 согласен». Идемпотентность обеспечивает PK
// (proposal_id, voter_id). После третьего голоса триггер БД сам
// применит предложение и переведёт status='applied'.
export async function voteForProposalAction(
  proposalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };

  const { error } = await supabase
    .from('edit_proposal_votes')
    .insert({ proposal_id: proposalId, voter_id: user.id });
  if (error) {
    // Уникальный конфликт (уже голосовал) — не показываем как ошибку,
    // молча считаем «уже подтверждено».
    if (String(error.message).toLowerCase().includes('duplicate')) return { ok: true };
    return { ok: false, error: translateDbError(error) };
  }
  revalidatePath('/inbox');
  return { ok: true };
}

export async function unvoteForProposalAction(
  proposalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };
  const { error } = await supabase
    .from('edit_proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('voter_id', user.id);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath('/inbox');
  return { ok: true };
}

// Автор объекта / админ — принять предложение вручную (обёртка над RPC
// fn_apply_edit_proposal). Возвращает {ok, error}.
export async function acceptProposalAction(
  proposalId: string,
  targetTable: 'boreholes' | 'observation_points',
  targetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_apply_edit_proposal' as never, {
    p_proposal_id: proposalId,
    p_bypass_permission: false,
  } as never);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath(
    targetTable === 'boreholes' ? `/boreholes/${targetId}` : `/observation-points/${targetId}`,
  );
  revalidatePath('/map');
  revalidatePath('/inbox');
  return { ok: true };
}

export async function rejectProposalAction(
  proposalId: string,
  note: string | null,
  targetTable: 'boreholes' | 'observation_points',
  targetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_reject_edit_proposal' as never, {
    p_proposal_id: proposalId,
    p_note: note,
  } as never);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath(
    targetTable === 'boreholes' ? `/boreholes/${targetId}` : `/observation-points/${targetId}`,
  );
  revalidatePath('/inbox');
  return { ok: true };
}

export async function withdrawProposalAction(
  proposalId: string,
  targetTable: 'boreholes' | 'observation_points',
  targetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_withdraw_edit_proposal' as never, {
    p_proposal_id: proposalId,
  } as never);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath(
    targetTable === 'boreholes' ? `/boreholes/${targetId}` : `/observation-points/${targetId}`,
  );
  revalidatePath('/inbox');
  return { ok: true };
}
