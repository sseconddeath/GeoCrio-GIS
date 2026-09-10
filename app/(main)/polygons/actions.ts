'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import { polygonInviteSchema, polygonSchema } from '@/lib/validation';

export interface PolygonActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

export interface InviteActionState {
  error?: string;
  success?: string;
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

// GeoJSON.Polygon → EWKT-строка «SRID=4326;POLYGON((lng lat, ...))».
// PostGIS принимает такую строку в текстовой колонке geometry.
function polygonToEWKT(polygon: GeoJSON.Polygon): string {
  const rings = polygon.coordinates
    .map(
      (ring) =>
        '(' + ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ') + ')',
    )
    .join(', ');
  return `SRID=4326;POLYGON(${rings})`;
}

function readFormData(fd: FormData) {
  const boundaryRaw = fd.get('boundary');
  let boundary: unknown = null;
  if (typeof boundaryRaw === 'string' && boundaryRaw.length > 0) {
    try {
      boundary = JSON.parse(boundaryRaw);
    } catch {
      boundary = null;
    }
  }
  return {
    name: fd.get('name'),
    description: fd.get('description'),
    boundary,
    is_public: fd.get('is_public'),
  };
}

export async function createPolygonAction(
  _prev: PolygonActionState,
  fd: FormData,
): Promise<PolygonActionState> {
  const parsed = polygonSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { name, description, boundary, is_public } = parsed.data;
  const { data, error } = await supabase
    .from('polygons')
    .insert({
      name,
      description,
      boundary: polygonToEWKT(boundary),
      is_public,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { error: translateDbError(error) };

  revalidatePath('/polygons');
  revalidatePath('/map');
  redirect(`/map?polygon=${(data as { id: string }).id}`);
}

export async function updatePolygonAction(
  id: string,
  _prev: PolygonActionState,
  fd: FormData,
): Promise<PolygonActionState> {
  const parsed = polygonSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  const { name, description, boundary, is_public } = parsed.data;
  const { error } = await supabase
    .from('polygons')
    .update({
      name,
      description,
      boundary: polygonToEWKT(boundary),
      is_public,
    })
    .eq('id', id);

  if (error) return { error: translateDbError(error) };

  revalidatePath('/polygons');
  revalidatePath(`/polygons/${id}`);
  revalidatePath('/map');
  redirect(`/polygons/${id}`);
}

// Переключение публичности отдельным action — чтобы делать с одной кнопки
// в настройках, без открытия полной формы редактирования.
export async function togglePolygonPublicAction(
  id: string,
  isPublic: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('polygons')
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) return { error: translateDbError(error) };
  revalidatePath('/polygons');
  revalidatePath(`/polygons/${id}`);
  revalidatePath(`/polygons/${id}/settings`);
  revalidatePath('/map');
  return {};
}

export async function deletePolygonAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('polygons').delete().eq('id', id);
  if (error) throw new Error(translateDbError(error));
  revalidatePath('/polygons');
  revalidatePath('/map');
  redirect('/polygons');
}

// ============================================================================
// Соавторы
// ============================================================================

export async function inviteMemberAction(
  polygonId: string,
  _prev: InviteActionState,
  fd: FormData,
): Promise<InviteActionState> {
  const parsed = polygonInviteSchema.safeParse({
    polygonId,
    email: fd.get('email'),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? 'Некорректные данные' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('invite_polygon_member' as never, {
    p_polygon_id: parsed.data.polygonId,
    p_email: parsed.data.email,
  } as never);

  if (error) return { error: translateDbError(error) };

  const rows = data as unknown as { status: string; user_id: string | null }[] | null;
  const status = rows?.[0]?.status;
  switch (status) {
    case 'invited':
      revalidatePath(`/polygons/${polygonId}/settings`);
      return { success: 'Пользователь добавлен в команду' };
    case 'already_member':
      return { error: 'Этот геолог уже в команде участка' };
    case 'not_registered':
      return {
        error:
          'Пользователь с таким email пока не зарегистрирован. Попросите коллегу создать аккаунт, потом пригласите снова.',
      };
    case 'forbidden':
      return { error: 'Приглашать коллег может только владелец участка' };
    default:
      return { error: 'Не удалось пригласить пользователя, попробуйте ещё раз' };
  }
}

export async function removeMemberAction(
  polygonId: string,
  userId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('polygon_members')
    .delete()
    .eq('polygon_id', polygonId)
    .eq('user_id', userId);
  if (error) return { error: translateDbError(error) };
  revalidatePath(`/polygons/${polygonId}/settings`);
  return {};
}
