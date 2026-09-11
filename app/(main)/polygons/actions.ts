'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import type { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';
import { polygonInviteSchema, polygonSchema } from '@/lib/validation';

export interface PolygonActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  // URL для клиентской навигации: server-action возвращает его вместо
  // прямого redirect(), потому что в React 19 / Next 16 redirect из
  // action не всегда пропагирует в браузер. Клиент видит это поле в
  // useActionState и делает router.push().
  redirectTo?: string;
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
  console.log('[createPolygonAction] called');
  const parsed = polygonSchema.safeParse(readFormData(fd));
  if (!parsed.success) {
    console.log('[createPolygonAction] validation failed:', parsed.error.issues);
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Требуется вход в систему' };

    const { name, description, boundary, is_public } = parsed.data;
    console.log('[createPolygonAction] inserting for user', user.id, {
      name,
      boundaryPoints: boundary.coordinates[0].length,
      is_public,
    });

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

    if (error) {
      console.error('[createPolygonAction] supabase insert error:', error);
      return { error: translateDbError(error) };
    }
    if (!data || !(data as { id?: string }).id) {
      return {
        error:
          'Участок создан, но нет прав его прочитать. Обратитесь к администратору.',
      };
    }

    const newId = (data as { id: string }).id;
    console.log('[createPolygonAction] created id=', newId);
    revalidatePath('/polygons');
    revalidatePath('/map');
    // Не используем redirect() — на связке React 19 + Next 16 бывают
    // случаи, когда исключение NEXT_REDIRECT из server action не
    // приводит к клиентской навигации. Возвращаем redirectTo и клиент
    // сам сделает router.push().
    return { redirectTo: `/map?polygon=${newId}` };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error('[createPolygonAction] unexpected error:', err);
    return {
      error:
        'Не удалось создать участок: ' +
        (err instanceof Error ? err.message : 'неизвестная ошибка'),
    };
  }
}

export async function updatePolygonAction(
  id: string,
  _prev: PolygonActionState,
  fd: FormData,
): Promise<PolygonActionState> {
  const parsed = polygonSchema.safeParse(readFormData(fd));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  try {
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

    if (error) {
      console.error('[updatePolygonAction] supabase update error:', error);
      return { error: translateDbError(error) };
    }

    revalidatePath('/polygons');
    revalidatePath(`/polygons/${id}`);
    revalidatePath('/map');
    return { redirectTo: `/polygons/${id}` };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error('[updatePolygonAction] unexpected error:', err);
    return {
      error:
        'Не удалось сохранить участок: ' +
        (err instanceof Error ? err.message : 'неизвестная ошибка'),
    };
  }
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

// ============================================================================
// Массовый импорт (Этап 7): CSV → множественная вставка объектов в участок
// ============================================================================

import { formatPointEWKT } from '@/lib/geo';
import type {
  BoreholeCsvRow,
  ObservationPointCsvRow,
} from '@/lib/csv-mapping';

const IMPORT_BATCH_LIMIT = 500;

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors?: string[];
}

// Импорт скважин. Клиент уже провалидировал строки через zod-schema
// (см. lib/csv-mapping.ts) — здесь только контроль лимита, привязка
// polygon_id + created_by и сам batch INSERT. RLS отсечёт запись,
// если пользователь не команда участка. PostGIS-триггер
// fn_validate_location_in_polygon отсечёт точки вне полигона (+500 м
// буфер). При ошибке в одной строке всё падает атомарно — Postgres
// откатит транзакцию (это дефолт для одного INSERT).
export async function bulkImportBoreholesAction(
  polygonId: string,
  rows: BoreholeCsvRow[],
): Promise<BulkImportResult> {
  if (rows.length === 0) return { imported: 0, failed: 0 };
  if (rows.length > IMPORT_BATCH_LIMIT) {
    return {
      imported: 0,
      failed: rows.length,
      errors: [`Слишком большой пакет (${rows.length}). Импортируйте не более ${IMPORT_BATCH_LIMIT} строк за раз.`],
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { imported: 0, failed: rows.length, errors: ['Требуется вход в систему'] };

  const payload = rows.map((r) => ({
    polygon_id: polygonId,
    code: r.code,
    location: formatPointEWKT(r.lng, r.lat),
    depth_m: r.depth_m ?? null,
    soil_type: r.soil_type ?? null,
    description: r.description ?? null,
    created_by: user.id,
  }));

  // as never — payload собран из zod-валидированных значений (schema
  // допускает только enum'ы), но узкие типы Database уже потеряны
  // после .map(). Проверка типа значений случилась ещё в csv-mapping.
  const { error, count } = await supabase
    .from('boreholes')
    .insert(payload as never, { count: 'exact' });
  if (error) {
    return { imported: 0, failed: rows.length, errors: [translateDbError(error)] };
  }
  revalidatePath(`/polygons/${polygonId}`);
  revalidatePath('/map');
  revalidatePath('/data');
  return { imported: count ?? rows.length, failed: 0 };
}

export async function bulkImportObservationPointsAction(
  polygonId: string,
  rows: ObservationPointCsvRow[],
): Promise<BulkImportResult> {
  if (rows.length === 0) return { imported: 0, failed: 0 };
  if (rows.length > IMPORT_BATCH_LIMIT) {
    return {
      imported: 0,
      failed: rows.length,
      errors: [`Слишком большой пакет (${rows.length}). Импортируйте не более ${IMPORT_BATCH_LIMIT} строк за раз.`],
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { imported: 0, failed: rows.length, errors: ['Требуется вход в систему'] };

  const payload = rows.map((r) => ({
    polygon_id: polygonId,
    code: r.code,
    location: formatPointEWKT(r.lng, r.lat),
    point_type: r.point_type,
    description: r.description ?? null,
    created_by: user.id,
  }));

  const { error, count } = await supabase
    .from('observation_points')
    .insert(payload as never, { count: 'exact' });
  if (error) {
    return { imported: 0, failed: rows.length, errors: [translateDbError(error)] };
  }
  revalidatePath(`/polygons/${polygonId}`);
  revalidatePath('/map');
  revalidatePath('/data');
  return { imported: count ?? rows.length, failed: 0 };
}
