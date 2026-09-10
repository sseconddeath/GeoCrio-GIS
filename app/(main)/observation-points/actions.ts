'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { formatPointEWKT } from '@/lib/geo';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import { observationPointSchema } from '@/lib/validation';

export interface ObservationPointActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
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

function readFormData(fd: FormData) {
  return {
    polygonId: fd.get('polygonId'),
    code: fd.get('code'),
    lng: fd.get('lng'),
    lat: fd.get('lat'),
    point_type: fd.get('point_type'),
    description: fd.get('description'),
  };
}

export async function createObservationPointAction(
  _prev: ObservationPointActionState,
  fd: FormData,
): Promise<ObservationPointActionState> {
  const parsed = observationPointSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { polygonId, code, lng, lat, point_type, description } = parsed.data;
  const { error } = await supabase.from('observation_points').insert({
    polygon_id: polygonId,
    code,
    location: formatPointEWKT(lng, lat),
    point_type,
    description,
    created_by: user.id,
  });
  if (error) return { error: translateDbError(error) };

  revalidatePath('/map');
  revalidatePath('/data');
  redirect('/map');
}

export async function updateObservationPointAction(
  id: string,
  _prev: ObservationPointActionState,
  fd: FormData,
): Promise<ObservationPointActionState> {
  const parsed = observationPointSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { code, lng, lat, point_type, description } = parsed.data;
  const { error } = await supabase
    .from('observation_points')
    .update({
      code,
      location: formatPointEWKT(lng, lat),
      point_type,
      description,
    })
    .eq('id', id);
  if (error) return { error: translateDbError(error) };

  revalidatePath('/map');
  revalidatePath('/data');
  revalidatePath(`/observation-points/${id}`);
  redirect(`/observation-points/${id}`);
}

export async function softDeleteObservationPointAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('observation_points')
    .update({ is_deleted: true })
    .eq('id', id);
  if (error) throw new Error(translateDbError(error));
  revalidatePath('/map');
  revalidatePath('/data');
  redirect('/map');
}

export async function restoreObservationPointAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('observation_points')
    .update({ is_deleted: false })
    .eq('id', id);
  if (error) throw new Error(translateDbError(error));
  revalidatePath('/map');
  revalidatePath('/data');
  revalidatePath(`/observation-points/${id}`);
}

// Queue-friendly версии (см. пояснение в boreholes/actions.ts).

export interface ObservationPointQueueInput {
  polygonId: string;
  code: string;
  lng: number;
  lat: number;
  point_type: string;
  description?: string | null;
}

export async function createObservationPointFromQueue(
  input: ObservationPointQueueInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = observationPointSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${String(first.path[0] ?? '')}: ${first.message}` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };

  const { polygonId, code, lng, lat, point_type, description } = parsed.data;
  const { error } = await supabase.from('observation_points').insert({
    polygon_id: polygonId,
    code,
    location: formatPointEWKT(lng, lat),
    point_type,
    description,
    created_by: user.id,
  });
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath('/map');
  revalidatePath('/data');
  return { ok: true };
}

export async function updateObservationPointFromQueue(
  id: string,
  input: ObservationPointQueueInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = observationPointSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${String(first.path[0] ?? '')}: ${first.message}` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };

  const { code, lng, lat, point_type, description } = parsed.data;
  const { error } = await supabase
    .from('observation_points')
    .update({ code, location: formatPointEWKT(lng, lat), point_type, description })
    .eq('id', id);
  if (error) return { ok: false, error: translateDbError(error) };
  revalidatePath('/map');
  revalidatePath('/data');
  revalidatePath(`/observation-points/${id}`);
  return { ok: true };
}
