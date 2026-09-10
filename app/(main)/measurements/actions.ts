'use server';

import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import { measurementSchema, type MeasurementInput } from '@/lib/validation';

export interface MeasurementActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

function readFormData(fd: FormData): unknown {
  return {
    boreholeId: fd.get('boreholeId'),
    depth_m: fd.get('depth_m'),
    temperature_c: fd.get('temperature_c'),
    measured_at: fd.get('measured_at'),
    notes: fd.get('notes'),
  };
}

// Форма — <form action={formAction}> в MeasurementForm. Server Action
// пишет замер и делает revalidatePath профиля скважины, чтобы список и
// график сразу обновились без ручного refresh.
export async function createMeasurementAction(
  _prev: MeasurementActionState,
  fd: FormData,
): Promise<MeasurementActionState> {
  const parsed = measurementSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { boreholeId, depth_m, temperature_c, measured_at, notes } = parsed.data;
  const { error } = await supabase.from('measurements').insert({
    borehole_id: boreholeId,
    depth_m,
    temperature_c,
    measured_at,
    notes,
    measured_by: user.id,
  });
  if (error) return { error: translateDbError(error) };

  revalidatePath(`/boreholes/${boreholeId}`);
  revalidatePath('/map');
  return { success: true };
}

// Мягкое удаление — is_deleted=true. Дальше замер не попадает ни в
// список, ни в T(z)-профиль, но остаётся в audit_log и потенциально
// восстанавливается в будущей корзине (Этап 5).
export async function softDeleteMeasurementAction(
  id: string,
  boreholeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('measurements')
    .update({ is_deleted: true })
    .eq('id', id);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath(`/boreholes/${boreholeId}`);
  revalidatePath('/map');
  return { ok: true };
}

// Queue-friendly версия для будущего офлайн-режима замеров (Этап 3.2c
// или 4.1). Пока не подключена — оставлена для будущего использования.
export async function createMeasurementFromQueue(
  input: MeasurementInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${String(first.path[0] ?? '')}: ${first.message}` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };

  const { boreholeId, depth_m, temperature_c, measured_at, notes } = parsed.data;
  const { error } = await supabase.from('measurements').insert({
    borehole_id: boreholeId,
    depth_m,
    temperature_c,
    measured_at,
    notes,
    measured_by: user.id,
  });
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath(`/boreholes/${boreholeId}`);
  revalidatePath('/map');
  return { ok: true };
}
