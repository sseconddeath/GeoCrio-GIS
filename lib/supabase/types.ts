// Ручные TypeScript-типы под схему БД из supabase/migrations/001_initial_schema.sql,
// 002_storage_setup.sql и 003_seed_polygon.sql (Этап 0/2).
//
// Синхронизировать вручную с каждой новой миграцией. При появлении реального
// Supabase-проекта сверить через `supabase gen types typescript --project-id <id>`
// — особое внимание на geometry-колонки (`location`, `boundary`, `bounds`):
// PostgREST по умолчанию отдаёт их как EWKB hex-строку, но с модификатором
// `.geojson()` из @supabase/postgrest-js — как готовый GeoJSON.
//
// В Этапе 2 карта читает объекты через view `map_objects` с `.geojson()`,
// поэтому здесь geometry-колонки типизированы как соответствующие
// GeoJSON.* типы (namespace GeoJSON транзитивно приходит от @types/geojson,
// подтягиваемого maplibre-gl). Если конкретный запрос читает без
// `.geojson()`, сверху удобно скастовать к `string` (EWKB hex).

export type UserRole = 'admin' | 'researcher' | 'student';
export type SoilType = 'clay' | 'loam' | 'sand' | 'gravel' | 'peat' | 'rock' | 'other';
export type PointType =
  | 'geological'
  | 'hydrological'
  | 'geomorphological'
  | 'geocryological'
  | 'vegetation'
  | 'other';
export type LayerType = 'raster' | 'vector';
export type SourceFormat = 'geotiff' | 'mbtiles' | 'png_tiles' | 'geojson' | 'shapefile';
export type ConflictResolution = 'auto_latest' | 'auto_code_rename' | 'manual' | 'pending';
export type AuditAction = 'insert' | 'update' | 'delete' | 'restore' | 'sync';
export type PermafrostStatus = 'unknown' | 'frozen' | 'thawed' | 'transitional';

// Пришло из @supabase/postgrest-js через `.geojson()` — реальный JS-объект.
// Без `.geojson()` PostgREST отдаёт EWKB hex-строку; в таких запросах
// удобно кастовать поле к string на месте.
type PointGeom = GeoJSON.Point;
type PolygonGeom = GeoJSON.Polygon;

export type ProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export type DeviceRow = {
  id: string;
  user_id: string;
  device_name: string | null;
  user_agent: string | null;
  last_sync_at: string | null;
  last_ip: string | null;
  created_at: string;
}

export type PolygonRow = {
  id: string;
  name: string;
  description: string | null;
  boundary: PolygonGeom;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PolygonMemberRow = {
  polygon_id: string;
  user_id: string;
  invited_by: string | null;
  created_at: string;
}

export type BoreholeRow = {
  id: string;
  polygon_id: string;
  code: string;
  draft_code: string | null;
  location: PointGeom;
  depth_m: number | null;
  soil_type: SoilType | null;
  description: string | null;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MeasurementRow = {
  id: string;
  borehole_id: string;
  depth_m: number;
  temperature_c: number;
  measured_at: string;
  measured_by: string | null;
  device_id: string | null;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
}

export type ObservationPointRow = {
  id: string;
  polygon_id: string;
  code: string;
  draft_code: string | null;
  location: PointGeom;
  point_type: PointType;
  description: string | null;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PhotoRow = {
  id: string;
  borehole_id: string | null;
  observation_point_id: string | null;
  polygon_id: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  location: PointGeom | null;
  taken_at: string | null;
  caption: string | null;
  file_size_kb: number | null;
  width_px: number | null;
  height_px: number | null;
  is_deleted: boolean;
  uploaded_by: string | null;
  device_id: string | null;
  created_at: string;
}

export type LayerRow = {
  id: string;
  polygon_id: string;
  name: string;
  layer_type: LayerType;
  source_format: SourceFormat | null;
  storage_path: string;
  bounds: PolygonGeom | null;
  min_zoom: number;
  max_zoom: number;
  opacity: number;
  is_visible: boolean;
  sort_order: number;
  file_size_mb: number | null;
  tile_count: number | null;
  is_deleted: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export type FieldNoteRow = {
  id: string;
  polygon_id: string;
  location: PointGeom | null;
  title: string | null;
  content: string;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
}

export type SyncConflictRow = {
  id: string;
  table_name: string;
  record_id: string;
  device_a_id: string | null;
  device_b_id: string | null;
  field_name: string;
  value_a: string | null;
  value_b: string | null;
  resolved_value: string | null;
  resolution: ConflictResolution;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  device_id: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// Этап 5.3: предложения правок.
export type EditProposalStatus = 'pending' | 'accepted' | 'rejected' | 'applied' | 'withdrawn';

export type EditProposalRow = {
  id: string;
  target_table: 'boreholes' | 'observation_points';
  target_id: string;
  polygon_id: string;
  proposed_by: string | null;
  reason: string;
  proposed_data: Record<string, string>;
  status: EditProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export type EditProposalVoteRow = {
  proposal_id: string;
  voter_id: string;
  created_at: string;
}

export type MapObjectRow = {
  id: string;
  name: string;
  type: string;
  location: PointGeom;
  polygon_id: string;
  depth_m: number | null;
  soil_type: SoilType | null;
  last_temperature: number | null;
  last_measured_at: string | null;
  permafrost_status: PermafrostStatus | null;
  photo_count: number;
}

export type PolygonStatsRow = {
  polygon_id: string;
  name: string;
  borehole_count: number;
  obs_point_count: number;
  photo_count: number;
  measurement_count: number;
}

export type BoreholeTemperatureProfileRow = {
  borehole_id: string;
  borehole_code: string;
  depth_m: number;
  temperature_c: number;
  measured_at: string;
}

// Форма ожидаемая @supabase/postgrest-js — обязательно поле Relationships
// (см. GenericTable/GenericView в postgrest-js/src/types/common/common.ts).
// FK-связи мы вручную не описываем, пустой массив подходит.
interface TableDef<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

interface ViewDef<Row> {
  Row: Row;
  Relationships: [];
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// При записи geometry PostgREST принимает EWKT-строку "SRID=4326;POINT(x y)"
// и приводит её к geometry неявно. На чтении geometry приходит как GeoJSON
// (при использовании .geojson()) или EWKB hex, но на записи типизируем
// поле как `PointGeom | string`, чтобы Server Action мог передать EWKT.
// Distributive-условие вида `PointGeom extends T[K]` работает и для
// опциональных полей (T[K] = PointGeom | undefined) и для nullable
// (T[K] = PointGeom | null) — если исходный тип содержит PointGeom/PolygonGeom,
// добавляем к нему `string` как альтернативу.
type WithGeometryWrite<T> = {
  [K in keyof T]: PointGeom extends T[K]
    ? T[K] | string
    : PolygonGeom extends T[K]
      ? T[K] | string
      : T[K];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Optional<ProfileRow, 'avatar_url' | 'created_at' | 'role'>,
        Partial<Omit<ProfileRow, 'id'>>
      >;
      devices: TableDef<
        DeviceRow,
        Optional<DeviceRow, 'id' | 'device_name' | 'user_agent' | 'last_sync_at' | 'last_ip' | 'created_at'>,
        Partial<Omit<DeviceRow, 'id'>>
      >;
      polygons: TableDef<
        PolygonRow,
        WithGeometryWrite<Optional<
          PolygonRow,
          'id' | 'description' | 'center_lat' | 'center_lng' | 'default_zoom' | 'is_public' | 'created_by' | 'created_at' | 'updated_at'
        >>,
        WithGeometryWrite<Partial<Omit<PolygonRow, 'id' | 'center_lat' | 'center_lng'>>>
      >;
      polygon_members: TableDef<
        PolygonMemberRow,
        Optional<PolygonMemberRow, 'invited_by' | 'created_at'>,
        Partial<Pick<PolygonMemberRow, 'invited_by'>>
      >;
      boreholes: TableDef<
        BoreholeRow,
        WithGeometryWrite<Optional<
          BoreholeRow,
          'id' | 'draft_code' | 'depth_m' | 'soil_type' | 'description' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at' | 'updated_at'
        >>,
        WithGeometryWrite<Partial<Omit<BoreholeRow, 'id'>>>
      >;
      measurements: TableDef<
        MeasurementRow,
        Optional<MeasurementRow, 'id' | 'measured_by' | 'device_id' | 'notes' | 'is_deleted' | 'created_at'>,
        Partial<Omit<MeasurementRow, 'id'>>
      >;
      observation_points: TableDef<
        ObservationPointRow,
        WithGeometryWrite<Optional<
          ObservationPointRow,
          'id' | 'draft_code' | 'description' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at' | 'updated_at'
        >>,
        WithGeometryWrite<Partial<Omit<ObservationPointRow, 'id'>>>
      >;
      photos: TableDef<
        PhotoRow,
        WithGeometryWrite<Optional<
          PhotoRow,
          | 'id'
          | 'borehole_id'
          | 'observation_point_id'
          | 'polygon_id'
          | 'thumbnail_path'
          | 'location'
          | 'taken_at'
          | 'caption'
          | 'file_size_kb'
          | 'width_px'
          | 'height_px'
          | 'is_deleted'
          | 'uploaded_by'
          | 'device_id'
          | 'created_at'
        >>,
        WithGeometryWrite<Partial<Omit<PhotoRow, 'id'>>>
      >;
      layers: TableDef<
        LayerRow,
        WithGeometryWrite<Optional<
          LayerRow,
          | 'id'
          | 'source_format'
          | 'bounds'
          | 'min_zoom'
          | 'max_zoom'
          | 'opacity'
          | 'is_visible'
          | 'sort_order'
          | 'file_size_mb'
          | 'tile_count'
          | 'is_deleted'
          | 'uploaded_by'
          | 'created_at'
        >>,
        WithGeometryWrite<Partial<Omit<LayerRow, 'id'>>>
      >;
      field_notes: TableDef<
        FieldNoteRow,
        WithGeometryWrite<Optional<FieldNoteRow, 'id' | 'location' | 'title' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at'>>,
        WithGeometryWrite<Partial<Omit<FieldNoteRow, 'id'>>>
      >;
      sync_conflicts: TableDef<
        SyncConflictRow,
        Optional<
          SyncConflictRow,
          | 'id'
          | 'device_a_id'
          | 'device_b_id'
          | 'value_a'
          | 'value_b'
          | 'resolved_value'
          | 'resolution'
          | 'resolved_by'
          | 'created_at'
          | 'resolved_at'
        >,
        Partial<Omit<SyncConflictRow, 'id'>>
      >;
      audit_log: TableDef<
        AuditLogRow,
        Optional<AuditLogRow, 'id' | 'user_id' | 'device_id' | 'old_data' | 'new_data' | 'created_at'>,
        Partial<Omit<AuditLogRow, 'id'>>
      >;
      edit_proposals: TableDef<
        EditProposalRow,
        Optional<
          EditProposalRow,
          | 'id'
          | 'status'
          | 'decided_by'
          | 'decided_at'
          | 'decision_note'
          | 'created_at'
          | 'updated_at'
        >,
        Partial<Omit<EditProposalRow, 'id'>>
      >;
      edit_proposal_votes: TableDef<
        EditProposalVoteRow,
        Optional<EditProposalVoteRow, 'created_at'>,
        Partial<EditProposalVoteRow>
      >;
    };
    Views: {
      map_objects: ViewDef<MapObjectRow>;
      polygon_stats: ViewDef<PolygonStatsRow>;
      borehole_temperature_profile: ViewDef<BoreholeTemperatureProfileRow>;
    };
    Functions: Record<string, never>;
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    CompositeTypes: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Enums: {};
  };
}
