import { cache } from 'react';
import { createClient } from './server';
import type {
  BoreholeRow,
  MapObjectRow,
  ObservationPointRow,
  PolygonMemberRow,
  PolygonRow,
  PolygonStatsRow,
  ProfileRow,
} from './types';

// ============================================================================
// Полигоны
// ============================================================================

// Полигон по id: доступ фильтруется RLS (свой / соавтор / публичный / админ).
export const getPolygon = cache(async (id: string): Promise<PolygonRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('polygons')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data as PolygonRow | null;
});

// Все полигоны, доступные текущему пользователю (свои + публичные + где он
// соавтор). RLS всё отфильтрует автоматически, но нам нужно разделение
// «мои» vs «публичные» в UI — тянем в двух вариантах.
export const listMyPolygons = cache(async (): Promise<PolygonRow[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('polygons')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });
  return (data as PolygonRow[]) ?? [];
});

// Полигоны, где текущий пользователь — соавтор (не автор). Простой JOIN
// через IN по списку id из polygon_members.
export const listSharedWithMePolygons = cache(async (): Promise<PolygonRow[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: memberships } = await supabase
    .from('polygon_members')
    .select('polygon_id')
    .eq('user_id', user.id);
  const ids = ((memberships as { polygon_id: string }[] | null) ?? []).map((m) => m.polygon_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('polygons')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  return (data as PolygonRow[]) ?? [];
});

// Публичные полигоны других пользователей (свои исключаем — они уже в «Моих»).
export const listPublicPolygons = cache(async (): Promise<PolygonRow[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = supabase
    .from('polygons')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  const { data } = user ? await query.neq('created_by', user.id) : await query;
  return (data as PolygonRow[]) ?? [];
});

// Может ли текущий пользователь редактировать объекты в полигоне
// (автор + соавтор + админ). Используется в page.tsx для проброса в UI и
// скрытия кнопок «Редактировать/Удалить» у чужих на публичном полигоне.
export const canWritePolygon = cache(async (polygonId: string): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  // Проверяем через helper-функцию БД — единая точка правды с RLS.
  const { data } = await supabase.rpc('fn_can_write_polygon' as never, {
    p_polygon_id: polygonId,
  } as never);
  return Boolean(data);
});

// Полигон — владелец? (для страницы настроек, приглашения соавторов)
export const isPolygonOwner = cache(async (polygonId: string): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('polygons')
    .select('created_by')
    .eq('id', polygonId)
    .maybeSingle();
  return (data as { created_by: string | null } | null)?.created_by === user.id;
});

// Соавторы полигона + автор — с профилями, для страницы «Участники».
// Возвращаем автора отдельным полем, чтобы UI показал его первым и
// подписал «Владелец».
export interface PolygonTeam {
  owner: Pick<ProfileRow, 'id' | 'full_name'> | null;
  members: (PolygonMemberRow & { profile: Pick<ProfileRow, 'id' | 'full_name'> | null })[];
}

export async function getPolygonTeam(polygonId: string): Promise<PolygonTeam> {
  const supabase = await createClient();
  const [{ data: polygon }, { data: members }] = await Promise.all([
    supabase.from('polygons').select('created_by').eq('id', polygonId).maybeSingle(),
    supabase
      .from('polygon_members')
      .select('*, profile:profiles!polygon_members_user_id_fkey(id, full_name)')
      .eq('polygon_id', polygonId)
      .order('created_at', { ascending: true }),
  ]);

  const ownerId = (polygon as { created_by: string | null } | null)?.created_by;
  let owner: PolygonTeam['owner'] = null;
  if (ownerId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', ownerId)
      .maybeSingle();
    owner = data as PolygonTeam['owner'];
  }

  return {
    owner,
    members: (members as PolygonTeam['members']) ?? [],
  };
}

// ============================================================================
// Объекты карты
// ============================================================================

// Все не-удалённые объекты полигона (скважины + точки), сразу как GeoJSON
// FeatureCollection — MapLibre скармливает такое в source: {type: 'geojson'}.
export async function getMapObjectsGeoJSON(
  polygonId: string,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, Omit<MapObjectRow, 'location'>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('map_objects')
    .select('*')
    .eq('polygon_id', polygonId)
    .geojson();

  if (error) {
    return { type: 'FeatureCollection', features: [] };
  }
  return data as unknown as GeoJSON.FeatureCollection<GeoJSON.Point, Omit<MapObjectRow, 'location'>>;
}

// Статистика полигона для боковой панели.
export async function getPolygonStats(polygonId: string): Promise<PolygonStatsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('polygon_stats')
    .select('*')
    .eq('polygon_id', polygonId)
    .maybeSingle();
  return data as PolygonStatsRow | null;
}

// Все объекты полигона плоским списком — для таблицы /data.
export async function listBoreholes(polygonId: string): Promise<BoreholeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('boreholes')
    .select('*')
    .eq('polygon_id', polygonId)
    .eq('is_deleted', false)
    .order('code', { ascending: true });
  return (data as BoreholeRow[]) ?? [];
}

export async function listObservationPoints(polygonId: string): Promise<ObservationPointRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('observation_points')
    .select('*')
    .eq('polygon_id', polygonId)
    .eq('is_deleted', false)
    .order('code', { ascending: true });
  return (data as ObservationPointRow[]) ?? [];
}

// Профиль одной скважины/точки — для страниц /boreholes/[id] и /observation-points/[id].
// .geojson() возвращает FeatureCollection даже для одного объекта — берём features[0].
export async function getBoreholeFeature(
  id: string,
): Promise<GeoJSON.Feature<GeoJSON.Point, BoreholeRow> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('boreholes')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .geojson();
  if (!data) return null;
  const fc = data as unknown as GeoJSON.FeatureCollection<GeoJSON.Point, BoreholeRow>;
  return fc.features[0] ?? null;
}

export async function getObservationPointFeature(
  id: string,
): Promise<GeoJSON.Feature<GeoJSON.Point, ObservationPointRow> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('observation_points')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .geojson();
  if (!data) return null;
  const fc = data as unknown as GeoJSON.FeatureCollection<GeoJSON.Point, ObservationPointRow>;
  return fc.features[0] ?? null;
}

// Автор объекта по id — для показа «Автор: Иванов И.И.» на карточках (B4).
// Отдельный запрос на profile, чтобы избежать сложного FK-embedding через
// PostgREST (там не всегда красиво типизируется).
export async function getProfileById(
  id: string | null,
): Promise<Pick<ProfileRow, 'id' | 'full_name'> | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', id)
    .maybeSingle();
  return data as Pick<ProfileRow, 'id' | 'full_name'> | null;
}

// ============================================================================
// Фото
// ============================================================================

export interface PhotoWithUrls {
  id: string;
  caption: string | null;
  taken_at: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_kb: number | null;
  thumbUrl: string | null;
  fullUrl: string | null;
}

// Список фото объекта + signed URLs (bucket photos приватный).
// TTL signed URL — 1 час, за это время пользователь успевает просмотреть
// галерею и открыть фото полноразмерно.
export async function listPhotosForParent(
  parent: { kind: 'borehole' | 'observation_point'; id: string },
): Promise<PhotoWithUrls[]> {
  const supabase = await createClient();
  const key = parent.kind === 'borehole' ? 'borehole_id' : 'observation_point_id';
  const { data } = await supabase
    .from('photos')
    .select('id, caption, taken_at, width_px, height_px, file_size_kb, storage_path, thumbnail_path')
    .eq(key, parent.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  const rows = (data as Array<{
    id: string;
    caption: string | null;
    taken_at: string | null;
    width_px: number | null;
    height_px: number | null;
    file_size_kb: number | null;
    storage_path: string;
    thumbnail_path: string | null;
  }> | null) ?? [];
  if (rows.length === 0) return [];

  const [fullSigned, thumbSigned] = await Promise.all([
    supabase.storage.from('photos').createSignedUrls(rows.map((r) => r.storage_path), 3600),
    supabase.storage
      .from('thumbnails')
      .createSignedUrls(rows.map((r) => r.thumbnail_path ?? r.storage_path), 3600),
  ]);
  const fullMap = new Map<string, string>();
  fullSigned.data?.forEach((s) => {
    if (s.path && s.signedUrl) fullMap.set(s.path, s.signedUrl);
  });
  const thumbMap = new Map<string, string>();
  thumbSigned.data?.forEach((s) => {
    if (s.path && s.signedUrl) thumbMap.set(s.path, s.signedUrl);
  });

  return rows.map((r) => ({
    id: r.id,
    caption: r.caption,
    taken_at: r.taken_at,
    width_px: r.width_px,
    height_px: r.height_px,
    file_size_kb: r.file_size_kb,
    fullUrl: fullMap.get(r.storage_path) ?? null,
    thumbUrl: r.thumbnail_path ? thumbMap.get(r.thumbnail_path) ?? null : null,
  }));
}
