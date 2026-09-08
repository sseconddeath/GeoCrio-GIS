// Ручные TypeScript-типы под схему БД из supabase/migrations/001_initial_schema.sql
// и 002_storage_setup.sql (Этап 0).
//
// Синхронизировать вручную с каждой новой миграцией. При появлении реального
// Supabase-проекта сверить через `supabase gen types typescript --project-id <id>`
// — особое внимание на geometry-колонки (`location`, `boundary`, `bounds`):
// PostgREST может отдавать их как GeoJSON или как WKB/hex в зависимости от
// версии/конфигурации, поэтому здесь они помечены `unknown` — распарсить
// решит Этап 2, когда появится реальный ответ API для сверки.
//
// Для Этапа 1 реально используется только `profiles`; остальные таблицы —
// контракт на будущие этапы.

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

type Geometry = unknown;

export interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  device_name: string | null;
  user_agent: string | null;
  last_sync_at: string | null;
  last_ip: string | null;
  created_at: string;
}

export interface PolygonRow {
  id: string;
  name: string;
  description: string | null;
  boundary: Geometry;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoreholeRow {
  id: string;
  polygon_id: string;
  code: string;
  draft_code: string | null;
  location: Geometry;
  depth_m: number | null;
  soil_type: SoilType | null;
  description: string | null;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeasurementRow {
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

export interface ObservationPointRow {
  id: string;
  polygon_id: string;
  code: string;
  draft_code: string | null;
  location: Geometry;
  point_type: PointType;
  description: string | null;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoRow {
  id: string;
  borehole_id: string | null;
  observation_point_id: string | null;
  polygon_id: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  location: Geometry | null;
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

export interface LayerRow {
  id: string;
  polygon_id: string;
  name: string;
  layer_type: LayerType;
  source_format: SourceFormat | null;
  storage_path: string;
  bounds: Geometry | null;
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

export interface FieldNoteRow {
  id: string;
  polygon_id: string;
  location: Geometry | null;
  title: string | null;
  content: string;
  is_deleted: boolean;
  created_by: string | null;
  device_id: string | null;
  created_at: string;
}

export interface SyncConflictRow {
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

export interface AuditLogRow {
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

export interface MapObjectRow {
  id: string;
  name: string;
  type: string;
  location: Geometry;
  polygon_id: string;
  depth_m: number | null;
  soil_type: SoilType | null;
  last_temperature: number | null;
  last_measured_at: string | null;
  permafrost_status: PermafrostStatus | null;
  photo_count: number;
}

export interface PolygonStatsRow {
  polygon_id: string;
  name: string;
  borehole_count: number;
  obs_point_count: number;
  photo_count: number;
  measurement_count: number;
}

export interface BoreholeTemperatureProfileRow {
  borehole_id: string;
  borehole_code: string;
  depth_m: number;
  temperature_c: number;
  measured_at: string;
}

interface TableDef<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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
        Optional<
          PolygonRow,
          'id' | 'description' | 'center_lat' | 'center_lng' | 'default_zoom' | 'created_by' | 'created_at' | 'updated_at'
        >,
        Partial<Omit<PolygonRow, 'id' | 'center_lat' | 'center_lng'>>
      >;
      boreholes: TableDef<
        BoreholeRow,
        Optional<
          BoreholeRow,
          'id' | 'draft_code' | 'depth_m' | 'soil_type' | 'description' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at' | 'updated_at'
        >,
        Partial<Omit<BoreholeRow, 'id'>>
      >;
      measurements: TableDef<
        MeasurementRow,
        Optional<MeasurementRow, 'id' | 'measured_by' | 'device_id' | 'notes' | 'is_deleted' | 'created_at'>,
        Partial<Omit<MeasurementRow, 'id'>>
      >;
      observation_points: TableDef<
        ObservationPointRow,
        Optional<
          ObservationPointRow,
          'id' | 'draft_code' | 'description' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at' | 'updated_at'
        >,
        Partial<Omit<ObservationPointRow, 'id'>>
      >;
      photos: TableDef<
        PhotoRow,
        Optional<
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
        >,
        Partial<Omit<PhotoRow, 'id'>>
      >;
      layers: TableDef<
        LayerRow,
        Optional<
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
        >,
        Partial<Omit<LayerRow, 'id'>>
      >;
      field_notes: TableDef<
        FieldNoteRow,
        Optional<FieldNoteRow, 'id' | 'location' | 'title' | 'is_deleted' | 'created_by' | 'device_id' | 'created_at'>,
        Partial<Omit<FieldNoteRow, 'id'>>
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
    };
    Views: {
      map_objects: { Row: MapObjectRow };
      polygon_stats: { Row: PolygonStatsRow };
      borehole_temperature_profile: { Row: BoreholeTemperatureProfileRow };
    };
  };
}
