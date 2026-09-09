'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { formatPointEWKT } from '@/lib/geo';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import { boreholeSchema } from '@/lib/validation';

export interface BoreholeActionState {
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
    depth_m: fd.get('depth_m'),
    soil_type: fd.get('soil_type'),
    description: fd.get('description'),
  };
}

export async function createBoreholeAction(
  _prev: BoreholeActionState,
  fd: FormData,
): Promise<BoreholeActionState> {
  const parsed = boreholeSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { polygonId, code, lng, lat, depth_m, soil_type, description } = parsed.data;
  const { error } = await supabase.from('boreholes').insert({
    polygon_id: polygonId,
    code,
    location: formatPointEWKT(lng, lat),
    depth_m,
    soil_type,
    description,
    created_by: user.id,
  });
  if (error) return { error: translateDbError(error) };

  revalidatePath('/map');
  revalidatePath('/data');
  redirect('/map');
}

export async function updateBoreholeAction(
  id: string,
  _prev: BoreholeActionState,
  fd: FormData,
): Promise<BoreholeActionState> {
  const parsed = boreholeSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { code, lng, lat, depth_m, soil_type, description } = parsed.data;
  const { error } = await supabase
    .from('boreholes')
    .update({
      code,
      location: formatPointEWKT(lng, lat),
      depth_m,
      soil_type,
      description,
    })
    .eq('id', id);
  if (error) return { error: translateDbError(error) };

  revalidatePath('/map');
  revalidatePath('/data');
  revalidatePath(`/boreholes/${id}`);
  redirect(`/boreholes/${id}`);
}

export async function softDeleteBoreholeAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('boreholes').update({ is_deleted: true }).eq('id', id);
  if (error) throw new Error(translateDbError(error));
  revalidatePath('/map');
  revalidatePath('/data');
  redirect('/map');
}

export async function restoreBoreholeAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('boreholes').update({ is_deleted: false }).eq('id', id);
  if (error) throw new Error(translateDbError(error));
  revalidatePath('/map');
  revalidatePath('/data');
  revalidatePath(`/boreholes/${id}`);
}
