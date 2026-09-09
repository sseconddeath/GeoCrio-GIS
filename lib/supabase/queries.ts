import { cache } from 'react';
import { createClient } from './server';
import type {
  BoreholeRow,
  MapObjectRow,
  ObservationPointRow,
  PolygonRow,
  PolygonStatsRow,
} from './types';

// Активный полигон. В Этапе 2 всегда один — тестовый seed из миграции 003.
// В Этапе 6 (админка полигонов) станет пользовательский выбор в UI, но
// сигнатура функции менять не придётся — просто внутри выберется полигон
// из cookie/URL.
export const getActivePolygon = cache(async (): Promise<PolygonRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('polygons')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as PolygonRow | null;
});

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
    // Пустая коллекция вместо исключения — карта продолжит рендериться.
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
// Возвращаем как обычные строки (без .geojson()), координаты берутся из
// центроида view map_objects, а сами карточки объектов открываются по id.
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
// .geojson() → удобно сразу читать coordinates из feature.geometry.
// .geojson() возвращает FeatureCollection даже для одного объекта — берём features[0].
// Именно эта форма ответа PostgREST'а: приведение сначала к `unknown`, потом к
// нужному типу — единственный безопасный путь, потому что `.geojson()` в
// @supabase/postgrest-js сужает тип до generic Record<string, unknown>.
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
