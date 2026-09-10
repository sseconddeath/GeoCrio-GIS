import { cache } from 'react';
import { createClient } from './server';
import type {
  BoreholeRow,
  BoreholeTemperatureProfileRow,
  EditProposalRow,
  MapObjectRow,
  MeasurementRow,
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

// ============================================================================
// Замеры температуры (Этап 4)
// ============================================================================

// Все замеры скважины, свежие сверху. RLS-фильтр наследуется от helper
// fn_can_read_polygon (мутации так же через fn_can_write_polygon).
export async function listMeasurementsForBorehole(
  boreholeId: string,
): Promise<MeasurementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('measurements')
    .select('*')
    .eq('borehole_id', boreholeId)
    .eq('is_deleted', false)
    .order('measured_at', { ascending: false })
    .order('depth_m', { ascending: true });
  return (data as MeasurementRow[]) ?? [];
}

// Температурный профиль T(z) — по одному значению на глубину (view
// borehole_temperature_profile сама берёт свежее измерение на каждой
// глубине через DISTINCT ON).
export async function getBoreholeTemperatureProfile(
  boreholeId: string,
): Promise<BoreholeTemperatureProfileRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('borehole_temperature_profile')
    .select('*')
    .eq('borehole_id', boreholeId)
    .order('depth_m', { ascending: true });
  return (data as BoreholeTemperatureProfileRow[]) ?? [];
}

// ============================================================================
// Корзина (Этап 5.2)
// ============================================================================

export interface TrashItem {
  kind: 'borehole' | 'observation_point' | 'measurement';
  id: string;
  code: string;
  updated_at: string;
  parentId?: string;
  parentCode?: string;
}

// Свои удалённые объекты — скважины, точки, замеры (в замерах нет
// created_by в чистом виде, идём через measured_by). Показываем всё,
// что помечено is_deleted=true — на будущее автоочистка старше 30
// дней (Этап 6, отдельный cron/edge). RLS фильтрует по полигону, так
// что чужое не всплывёт.
export async function listMyTrash(): Promise<TrashItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [boreholes, points, measurements] = await Promise.all([
    supabase
      .from('boreholes')
      .select('id, code, updated_at')
      .eq('is_deleted', true)
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('observation_points')
      .select('id, code, updated_at')
      .eq('is_deleted', true)
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('measurements')
      .select('id, depth_m, temperature_c, borehole_id, created_at')
      .eq('is_deleted', true)
      .eq('measured_by', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const items: TrashItem[] = [];
  for (const b of ((boreholes.data as Array<{ id: string; code: string; updated_at: string }> | null) ?? [])) {
    items.push({ kind: 'borehole', id: b.id, code: b.code, updated_at: b.updated_at });
  }
  for (const p of ((points.data as Array<{ id: string; code: string; updated_at: string }> | null) ?? [])) {
    items.push({ kind: 'observation_point', id: p.id, code: p.code, updated_at: p.updated_at });
  }

  // Для замеров подтягиваем код скважины отдельным запросом (один IN),
  // чтобы в списке было понятно «замер −1.2 °C @ 3 м из скважины Скв-01».
  type MeasurementTrashRow = {
    id: string;
    depth_m: number;
    temperature_c: number;
    borehole_id: string;
    created_at: string;
  };
  const measRows = ((measurements.data as MeasurementTrashRow[] | null) ?? []);
  const boreholeIds = Array.from(new Set(measRows.map((m) => m.borehole_id)));
  const boreholeCodes = new Map<string, string>();
  if (boreholeIds.length > 0) {
    const { data } = await supabase.from('boreholes').select('id, code').in('id', boreholeIds);
    for (const b of ((data as Array<{ id: string; code: string }> | null) ?? [])) {
      boreholeCodes.set(b.id, b.code);
    }
  }
  for (const m of measRows) {
    items.push({
      kind: 'measurement',
      id: m.id,
      code: `${formatSignedTemp(m.temperature_c)} °C @ ${m.depth_m} м`,
      updated_at: m.created_at,
      parentId: m.borehole_id,
      parentCode: boreholeCodes.get(m.borehole_id),
    });
  }

  items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return items;
}

function formatSignedTemp(t: number): string {
  const sign = t > 0 ? '+' : '';
  return `${sign}${t}`;
}

// ============================================================================
// История изменений объекта (Этап 5.2)
// ============================================================================

export interface ObjectHistoryEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: 'insert' | 'update' | 'delete' | 'restore' | 'sync';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// Читает audit_log через RPC fn_object_history (SECURITY DEFINER +
// проверка fn_can_read_polygon внутри). audit_log под RLS «только для
// админов», а мы хотим показать историю всем, кто может читать
// полигон объекта.
export async function listObjectHistory(
  table: 'boreholes' | 'observation_points' | 'measurements' | 'polygons',
  recordId: string,
): Promise<ObjectHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_object_history' as never, {
    p_table: table,
    p_record_id: recordId,
  } as never);
  if (error) return [];
  return (data as ObjectHistoryEntry[]) ?? [];
}

// ============================================================================
// Предложения правок (Этап 5.3)
// ============================================================================

export interface EditProposalWithMeta extends EditProposalRow {
  proposer_name: string | null;
  votes_count: number;
  my_vote: boolean;
  can_decide: boolean; // текущий пользователь = автор объекта или админ
  target_code: string | null;
}

// Читаем pending-предложения для объекта. Использует RLS: невидимые
// предложения (чужой приватный полигон) не вернутся.
export async function listPendingProposalsForObject(
  targetTable: 'boreholes' | 'observation_points',
  targetId: string,
): Promise<EditProposalWithMeta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawRows } = await supabase
    .from('edit_proposals')
    .select('*')
    .eq('target_table', targetTable)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  const rows = (rawRows as EditProposalRow[] | null) ?? [];
  if (rows.length === 0) return [];

  return enrichProposals(rows, user?.id ?? null);
}

// Инбокс: 1) чужие pending-предложения по МОИМ объектам (мне решать);
//         2) мои собственные pending (я их автор — могу отзывать).
// Один запрос по target_id-ам моих объектов + один запрос по своим
// proposed_by. Простое объединение.
export async function listMyInbox(): Promise<{
  incoming: EditProposalWithMeta[];
  outgoing: EditProposalWithMeta[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { incoming: [], outgoing: [] };

  const [myBoreholes, myPoints] = await Promise.all([
    supabase.from('boreholes').select('id').eq('created_by', user.id).eq('is_deleted', false),
    supabase
      .from('observation_points')
      .select('id')
      .eq('created_by', user.id)
      .eq('is_deleted', false),
  ]);
  const myBoreholeIds = ((myBoreholes.data as Array<{ id: string }> | null) ?? []).map((r) => r.id);
  const myPointIds = ((myPoints.data as Array<{ id: string }> | null) ?? []).map((r) => r.id);

  // Оба запроса делаем всегда, но с `in()` пустого массива Supabase
  // возвращает пусто без ошибки.
  const [incomingBoreholesRes, incomingPointsRes, outgoingRes] = await Promise.all([
    myBoreholeIds.length > 0
      ? supabase
          .from('edit_proposals')
          .select('*')
          .eq('target_table', 'boreholes')
          .in('target_id', myBoreholeIds)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as EditProposalRow[] }),
    myPointIds.length > 0
      ? supabase
          .from('edit_proposals')
          .select('*')
          .eq('target_table', 'observation_points')
          .in('target_id', myPointIds)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as EditProposalRow[] }),
    supabase
      .from('edit_proposals')
      .select('*')
      .eq('proposed_by', user.id)
      .eq('status', 'pending'),
  ]);

  const incomingRaw = [
    ...(((incomingBoreholesRes as { data: EditProposalRow[] | null }).data) ?? []),
    ...(((incomingPointsRes as { data: EditProposalRow[] | null }).data) ?? []),
  ];
  incomingRaw.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const outgoingRaw = ((outgoingRes.data as EditProposalRow[] | null) ?? [])
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const [incoming, outgoing] = await Promise.all([
    enrichProposals(incomingRaw, user.id),
    enrichProposals(outgoingRaw, user.id),
  ]);

  return { incoming, outgoing };
}

// Один общий helper: подкачивает имена проповедавших, коды объектов,
// голоса. Считается локально в Node — по 3 запроса всего.
async function enrichProposals(
  rows: EditProposalRow[],
  currentUserId: string | null,
): Promise<EditProposalWithMeta[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();

  const proposerIds = Array.from(new Set(rows.map((r) => r.proposed_by).filter(Boolean))) as string[];
  const boreholeIds = Array.from(new Set(rows.filter((r) => r.target_table === 'boreholes').map((r) => r.target_id)));
  const pointIds = Array.from(new Set(rows.filter((r) => r.target_table === 'observation_points').map((r) => r.target_id)));
  const proposalIds = rows.map((r) => r.id);

  const [profilesRes, boreholesRes, pointsRes, votesRes] = await Promise.all([
    proposerIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', proposerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    boreholeIds.length > 0
      ? supabase.from('boreholes').select('id, code, created_by').in('id', boreholeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; code: string; created_by: string | null }> }),
    pointIds.length > 0
      ? supabase.from('observation_points').select('id, code, created_by').in('id', pointIds)
      : Promise.resolve({ data: [] as Array<{ id: string; code: string; created_by: string | null }> }),
    supabase.from('edit_proposal_votes').select('proposal_id, voter_id').in('proposal_id', proposalIds),
  ]);

  type Profile = { id: string; full_name: string };
  type ObjMeta = { id: string; code: string; created_by: string | null };
  type Vote = { proposal_id: string; voter_id: string };

  const profileNameById = new Map<string, string>(
    ((profilesRes.data as Profile[] | null) ?? []).map((p) => [p.id, p.full_name]),
  );
  const boreholeById = new Map<string, ObjMeta>(
    ((boreholesRes.data as ObjMeta[] | null) ?? []).map((b) => [b.id, b]),
  );
  const pointById = new Map<string, ObjMeta>(
    ((pointsRes.data as ObjMeta[] | null) ?? []).map((p) => [p.id, p]),
  );
  const votesByProposal = new Map<string, Vote[]>();
  for (const v of ((votesRes.data as Vote[] | null) ?? [])) {
    const list = votesByProposal.get(v.proposal_id) ?? [];
    list.push(v);
    votesByProposal.set(v.proposal_id, list);
  }

  return rows.map((row) => {
    const votes = votesByProposal.get(row.id) ?? [];
    const target =
      row.target_table === 'boreholes'
        ? boreholeById.get(row.target_id)
        : pointById.get(row.target_id);
    return {
      ...row,
      proposer_name: row.proposed_by ? profileNameById.get(row.proposed_by) ?? null : null,
      votes_count: votes.length,
      my_vote: currentUserId
        ? votes.some((v) => v.voter_id === currentUserId)
        : false,
      can_decide: !!(currentUserId && target?.created_by === currentUserId),
      target_code: target?.code ?? null,
    };
  });
}
