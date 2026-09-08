-- ГеоКрио ГИС — начальная схема БД
-- Соответствует разделу 4 ТЗ + правкам из дополнения (RLS profiles, audit для layers, Realtime)
-- + исправления, найденные при повторной проверке (см. docs/schema-review.md):
--   - автосоздание profiles при регистрации
--   - SECURITY DEFINER для audit/role-триггеров (иначе RLS на audit_log блокирует все аудируемые операции)
--   - триггер, запрещающий самостоятельное повышение роли
--   - SET search_path для SECURITY DEFINER функций
--   - устранён дублирующийся индекс на boreholes(polygon_id, code)
--   - polygon_stats: согласованный подсчёт с учётом is_deleted

-- =========================================================================
-- 1. Расширения
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. Таблицы
-- =========================================================================

CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'student'
                CHECK (role IN ('admin', 'researcher', 'student')),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_name     TEXT,
    user_agent      TEXT,
    last_sync_at    TIMESTAMPTZ,
    last_ip         INET,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, device_name)
);

CREATE TABLE polygons (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    boundary     GEOMETRY(Polygon, 4326) NOT NULL,
    center_lat   DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(ST_Centroid(boundary))) STORED,
    center_lng   DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(ST_Centroid(boundary))) STORED,
    default_zoom INTEGER DEFAULT 13 CHECK (default_zoom BETWEEN 1 AND 20),
    created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_polygons_boundary ON polygons USING GIST (boundary);

CREATE TABLE boreholes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polygon_id  UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    draft_code  TEXT,                                    -- временный код из офлайн-режима
    location    GEOMETRY(Point, 4326) NOT NULL,
    depth_m     DECIMAL(6,2) CHECK (depth_m > 0 AND depth_m <= 500),
    soil_type   TEXT CHECK (soil_type IN (
                    'clay', 'loam', 'sand', 'gravel', 'peat', 'rock', 'other'
                )),
    description TEXT,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (polygon_id, code)
);
CREATE INDEX idx_boreholes_location ON boreholes USING GIST (location);
CREATE INDEX idx_boreholes_polygon  ON boreholes (polygon_id) WHERE NOT is_deleted;
-- idx_boreholes_code (polygon_id, code) сознательно не создаётся:
-- UNIQUE (polygon_id, code) уже создаёт эквивалентный индекс.

CREATE TABLE measurements (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borehole_id    UUID NOT NULL REFERENCES boreholes(id) ON DELETE CASCADE,
    depth_m        DECIMAL(6,2) NOT NULL CHECK (depth_m > 0 AND depth_m <= 500),
    temperature_c  DECIMAL(5,2) NOT NULL CHECK (temperature_c BETWEEN -50 AND 50),
    measured_at    TIMESTAMPTZ NOT NULL,
    measured_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id      UUID REFERENCES devices(id) ON DELETE SET NULL,
    notes          TEXT,
    is_deleted     BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (borehole_id, depth_m, measured_at, measured_by)
);
ALTER TABLE measurements ADD CONSTRAINT chk_measured_at_not_future
    CHECK (measured_at <= NOW() + INTERVAL '1 hour');
CREATE INDEX idx_measurements_borehole ON measurements (borehole_id, measured_at DESC)
    WHERE NOT is_deleted;

CREATE TABLE observation_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polygon_id  UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    draft_code  TEXT,
    location    GEOMETRY(Point, 4326) NOT NULL,
    point_type  TEXT NOT NULL CHECK (point_type IN (
        'geological', 'hydrological', 'geomorphological',
        'geocryological', 'vegetation', 'other'
    )),
    description TEXT,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (polygon_id, code)
);
CREATE INDEX idx_obs_location ON observation_points USING GIST (location);
CREATE INDEX idx_obs_polygon  ON observation_points (polygon_id) WHERE NOT is_deleted;

CREATE TABLE photos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borehole_id          UUID REFERENCES boreholes(id) ON DELETE CASCADE,
    observation_point_id UUID REFERENCES observation_points(id) ON DELETE CASCADE,
    polygon_id           UUID REFERENCES polygons(id) ON DELETE CASCADE,
    storage_path         TEXT NOT NULL,
    thumbnail_path       TEXT,
    location             GEOMETRY(Point, 4326),
    taken_at             TIMESTAMPTZ,
    caption              TEXT,
    file_size_kb         INTEGER CHECK (file_size_kb > 0),
    width_px             INTEGER,
    height_px            INTEGER,
    is_deleted           BOOLEAN DEFAULT FALSE,
    uploaded_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id            UUID REFERENCES devices(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_photo_single_parent CHECK (
        (borehole_id IS NOT NULL)::int +
        (observation_point_id IS NOT NULL)::int +
        (polygon_id IS NOT NULL)::int = 1
    )
);
CREATE INDEX idx_photos_borehole ON photos (borehole_id) WHERE borehole_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_photos_obs      ON photos (observation_point_id) WHERE observation_point_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_photos_polygon  ON photos (polygon_id) WHERE polygon_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_photos_location ON photos USING GIST (location);

CREATE TABLE layers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polygon_id     UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    layer_type     TEXT NOT NULL CHECK (layer_type IN ('raster', 'vector')),
    source_format  TEXT CHECK (source_format IN (
        'geotiff', 'mbtiles', 'png_tiles', 'geojson', 'shapefile'
    )),
    storage_path   TEXT NOT NULL,
    bounds         GEOMETRY(Polygon, 4326),
    min_zoom       INTEGER DEFAULT 8 CHECK (min_zoom BETWEEN 0 AND 22),
    max_zoom       INTEGER DEFAULT 18 CHECK (max_zoom BETWEEN 0 AND 22),
    opacity        DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity BETWEEN 0 AND 1),
    is_visible     BOOLEAN DEFAULT TRUE,
    sort_order     INTEGER DEFAULT 0,
    file_size_mb   DECIMAL(8,2),
    tile_count     INTEGER,
    is_deleted     BOOLEAN DEFAULT FALSE,
    uploaded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_zoom_range CHECK (min_zoom <= max_zoom)
);

CREATE TABLE field_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polygon_id  UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    location    GEOMETRY(Point, 4326),
    title       TEXT,
    content     TEXT NOT NULL,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_polygon ON field_notes (polygon_id) WHERE NOT is_deleted;

CREATE TABLE sync_conflicts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name     TEXT NOT NULL,
    record_id      UUID NOT NULL,
    device_a_id    UUID REFERENCES devices(id),
    device_b_id    UUID REFERENCES devices(id),
    field_name     TEXT NOT NULL,
    value_a        TEXT,
    value_b        TEXT,
    resolved_value TEXT,
    resolution     TEXT DEFAULT 'pending'
                   CHECK (resolution IN ('auto_latest', 'auto_code_rename', 'manual', 'pending')),
    resolved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ
);
CREATE INDEX idx_conflicts_pending ON sync_conflicts (created_at DESC)
    WHERE resolution = 'pending';

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    action      TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'restore', 'sync')),
    table_name  TEXT NOT NULL,
    record_id   UUID NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_record ON audit_log (table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_user   ON audit_log (user_id, created_at DESC);

-- =========================================================================
-- 3. Функции и триггеры
-- =========================================================================

-- 3.1 Автообновление updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_boreholes_ts BEFORE UPDATE ON boreholes
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER tr_obs_points_ts BEFORE UPDATE ON observation_points
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER tr_polygons_ts BEFORE UPDATE ON polygons
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- 3.2 Автосоздание profiles при регистрации в auth.users
-- (без этого RLS/роли не работают: после signUp() строки в profiles просто не существует)
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        'student'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- 3.3 is_admin() — используется в RLS-политиках и триггерах.
-- SECURITY DEFINER + фиксированный search_path (иначе возможна подмена search_path).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 3.4 Запрет самостоятельного изменения своей роли.
-- RLS-политика profiles_update_own разрешает пользователю обновлять свою же строку,
-- но не различает поля — без этого триггера студент может сам назначить себе role='admin'.
--
-- Проверка auth.uid() IS NOT NULL ограничивает блокировку только запросами через
-- REST API от имени конечного пользователя (там, где и была исходная уязвимость).
-- Без неё функция создаёт дедлок для самого первого администратора: назначить его
-- можно только UPDATE-ом, а UPDATE заблокирован, пока админов ещё нет вообще —
-- даже из Supabase SQL Editor / под service_role, где auth.uid() всегда NULL.
CREATE OR REPLACE FUNCTION fn_prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND NEW.role IS DISTINCT FROM OLD.role
       AND NOT is_admin() THEN
        RAISE EXCEPTION 'Недостаточно прав для изменения роли пользователя';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_prevent_self_role_change
    BEFORE UPDATE OF role ON profiles
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_self_role_change();

-- 3.5 Универсальный аудит (на всех таблицах с данными, включая profiles).
--
-- Важно: обращение вида (NEW).created_by / (OLD).measured_by к композитному типу
-- резолвится на этапе разбора выражения, а не лениво по ветке CASE — то есть в
-- исходной формулировке ТЗ функция падала бы уже на первой вставке в boreholes,
-- поскольку в том же CASE есть (NEW).measured_by/(NEW).uploaded_by, которых у
-- boreholes нет. Здесь вместо этого используется to_jsonb(...)->>'field' —
-- безопасный доступ по ключу, не зависящий от того, есть ли такая колонка у
-- конкретной таблицы (для отсутствующей колонки просто вернётся NULL).
--
-- SECURITY DEFINER обязателен: audit_log имеет RLS только с SELECT-политикой для
-- админа, без DEFINER любая вставка/обновление аудируемых таблиц падала бы с
-- ошибкой RLS при попытке записать строку в audit_log.
CREATE OR REPLACE FUNCTION fn_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_action TEXT;
    v_old_deleted BOOLEAN;
    v_new_deleted BOOLEAN;
BEGIN
    v_old := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_new := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;

    v_user_id := COALESCE(
        (v_new ->> 'created_by')::uuid,
        (v_new ->> 'measured_by')::uuid,
        (v_new ->> 'uploaded_by')::uuid,
        (v_old ->> 'created_by')::uuid,
        (v_old ->> 'measured_by')::uuid,
        (v_old ->> 'uploaded_by')::uuid,
        -- profiles: своего создателя/загрузчика не существует, аудируемый субъект — сам пользователь
        CASE WHEN TG_TABLE_NAME = 'profiles'
            THEN COALESCE((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid)
        END
    );

    IF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    ELSIF TG_OP = 'INSERT' THEN
        v_action := 'insert';
    ELSE
        v_old_deleted := (v_old ->> 'is_deleted')::boolean;
        v_new_deleted := (v_new ->> 'is_deleted')::boolean;
        IF v_old_deleted IS DISTINCT FROM v_new_deleted THEN
            v_action := CASE WHEN v_new_deleted THEN 'delete' ELSE 'restore' END;
        ELSE
            v_action := 'update';
        END IF;
    END IF;

    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
        v_user_id, v_action, TG_TABLE_NAME,
        COALESCE((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
        v_old, v_new
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tr_audit_boreholes AFTER INSERT OR UPDATE OR DELETE ON boreholes
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
CREATE TRIGGER tr_audit_measurements AFTER INSERT OR UPDATE OR DELETE ON measurements
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
CREATE TRIGGER tr_audit_obs_points AFTER INSERT OR UPDATE OR DELETE ON observation_points
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
CREATE TRIGGER tr_audit_photos AFTER INSERT OR UPDATE OR DELETE ON photos
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
CREATE TRIGGER tr_audit_field_notes AFTER INSERT OR UPDATE OR DELETE ON field_notes
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
CREATE TRIGGER tr_audit_layers AFTER INSERT OR UPDATE OR DELETE ON layers
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();
-- Смена роли — событие безопасности, тоже подлежит аудиту.
CREATE TRIGGER tr_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();

-- 3.6 Валидация: точка внутри полигона (+500м буфер)
CREATE OR REPLACE FUNCTION fn_validate_location_in_polygon()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM polygons p
        WHERE p.id = NEW.polygon_id
        AND ST_DWithin(p.boundary::geography, NEW.location::geography, 500)
    ) THEN
        RAISE EXCEPTION 'Точка за пределами полигона (буфер 500м)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_borehole_in_polygon BEFORE INSERT OR UPDATE OF location ON boreholes
    FOR EACH ROW EXECUTE FUNCTION fn_validate_location_in_polygon();
CREATE TRIGGER tr_obs_in_polygon BEFORE INSERT OR UPDATE OF location ON observation_points
    FOR EACH ROW EXECUTE FUNCTION fn_validate_location_in_polygon();

-- =========================================================================
-- 4. Row Level Security
-- =========================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE polygons ENABLE ROW LEVEL SECURITY;
ALTER TABLE boreholes ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- PROFILES: все читают; пользователь редактирует свою строку (кроме role — см. триггер выше);
-- админ может редактировать любую строку, включая role.
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_role" ON profiles FOR UPDATE USING (is_admin());

-- POLYGONS: все читают, только админ создаёт/редактирует
CREATE POLICY "polygons_read" ON polygons FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "polygons_insert" ON polygons FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "polygons_update" ON polygons FOR UPDATE USING (is_admin());
CREATE POLICY "polygons_delete" ON polygons FOR DELETE USING (is_admin());

-- BOREHOLES: все читают, автор создаёт, автор+админ редактируют, только админ удаляет
CREATE POLICY "bh_read" ON boreholes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bh_insert" ON boreholes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "bh_update" ON boreholes FOR UPDATE USING (auth.uid() = created_by OR is_admin());
CREATE POLICY "bh_delete" ON boreholes FOR DELETE USING (is_admin());

-- MEASUREMENTS: аналогично boreholes
CREATE POLICY "ms_read" ON measurements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ms_insert" ON measurements FOR INSERT WITH CHECK (auth.uid() = measured_by);
CREATE POLICY "ms_update" ON measurements FOR UPDATE USING (auth.uid() = measured_by OR is_admin());
CREATE POLICY "ms_delete" ON measurements FOR DELETE USING (is_admin());

-- OBSERVATION_POINTS: аналогично boreholes
CREATE POLICY "op_read" ON observation_points FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "op_insert" ON observation_points FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "op_update" ON observation_points FOR UPDATE USING (auth.uid() = created_by OR is_admin());
CREATE POLICY "op_delete" ON observation_points FOR DELETE USING (is_admin());

-- PHOTOS: аналогично
CREATE POLICY "ph_read" ON photos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ph_insert" ON photos FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "ph_update" ON photos FOR UPDATE USING (auth.uid() = uploaded_by OR is_admin());
CREATE POLICY "ph_delete" ON photos FOR DELETE USING (is_admin());

-- FIELD_NOTES: аналогично
CREATE POLICY "fn_read" ON field_notes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fn_insert" ON field_notes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "fn_update" ON field_notes FOR UPDATE USING (auth.uid() = created_by OR is_admin());
CREATE POLICY "fn_delete" ON field_notes FOR DELETE USING (is_admin());

-- LAYERS: только админ загружает, все читают
CREATE POLICY "ly_read" ON layers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ly_insert" ON layers FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "ly_update" ON layers FOR UPDATE USING (is_admin());
CREATE POLICY "ly_delete" ON layers FOR DELETE USING (is_admin());

-- SYNC_CONFLICTS: все видят, только админ разрешает
CREATE POLICY "sc_read" ON sync_conflicts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sc_update" ON sync_conflicts FOR UPDATE USING (is_admin());

-- AUDIT_LOG: только админ читает (запись — только через SECURITY DEFINER триггер выше)
CREATE POLICY "al_read" ON audit_log FOR SELECT USING (is_admin());

-- DEVICES: каждый видит только свои
CREATE POLICY "dev_read" ON devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dev_insert" ON devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dev_update" ON devices FOR UPDATE USING (auth.uid() = user_id);

-- =========================================================================
-- 5. Views
-- =========================================================================

-- Все объекты на карте с последней температурой и вычисленным статусом мерзлоты
CREATE OR REPLACE VIEW map_objects AS
    SELECT
        b.id, b.code AS name, 'borehole' AS type,
        b.location, b.polygon_id, b.depth_m, b.soil_type,
        lm.temperature_c AS last_temperature,
        lm.measured_at AS last_measured_at,
        CASE
            WHEN lm.temperature_c IS NULL THEN 'unknown'
            WHEN lm.temperature_c < -0.5 THEN 'frozen'
            WHEN lm.temperature_c > 0.5 THEN 'thawed'
            ELSE 'transitional'
        END AS permafrost_status,
        (SELECT COUNT(*) FROM photos p WHERE p.borehole_id = b.id AND NOT p.is_deleted) AS photo_count
    FROM boreholes b
    LEFT JOIN LATERAL (
        SELECT m.temperature_c, m.measured_at
        FROM measurements m WHERE m.borehole_id = b.id AND NOT m.is_deleted
        ORDER BY m.measured_at DESC LIMIT 1
    ) lm ON true
    WHERE NOT b.is_deleted
    UNION ALL
    SELECT
        op.id, op.code AS name, op.point_type AS type,
        op.location, op.polygon_id, NULL, NULL, NULL, NULL, NULL,
        (SELECT COUNT(*) FROM photos p WHERE p.observation_point_id = op.id AND NOT p.is_deleted)
    FROM observation_points op WHERE NOT op.is_deleted;

-- Статистика полигона (согласованный подсчёт: удалённые скважины/точки исключены везде)
CREATE OR REPLACE VIEW polygon_stats AS
    SELECT p.id AS polygon_id, p.name,
        (SELECT COUNT(*) FROM boreholes b WHERE b.polygon_id = p.id AND NOT b.is_deleted) AS borehole_count,
        (SELECT COUNT(*) FROM observation_points op WHERE op.polygon_id = p.id AND NOT op.is_deleted) AS obs_point_count,
        (SELECT COUNT(*) FROM photos ph WHERE (
            ph.borehole_id IN (SELECT id FROM boreholes WHERE polygon_id = p.id AND NOT is_deleted)
            OR ph.observation_point_id IN (SELECT id FROM observation_points WHERE polygon_id = p.id AND NOT is_deleted)
            OR ph.polygon_id = p.id
        ) AND NOT ph.is_deleted) AS photo_count,
        (SELECT COUNT(*) FROM measurements ms JOIN boreholes b3 ON ms.borehole_id = b3.id
            WHERE b3.polygon_id = p.id AND NOT b3.is_deleted AND NOT ms.is_deleted) AS measurement_count
    FROM polygons p;

-- Температурный профиль скважины
CREATE OR REPLACE VIEW borehole_temperature_profile AS
    SELECT DISTINCT ON (m.borehole_id, m.depth_m)
        m.borehole_id, b.code AS borehole_code,
        m.depth_m, m.temperature_c, m.measured_at
    FROM measurements m JOIN boreholes b ON b.id = m.borehole_id
    WHERE NOT m.is_deleted AND NOT b.is_deleted
    ORDER BY m.borehole_id, m.depth_m, m.measured_at DESC;

-- =========================================================================
-- 6. Realtime (см. дополнение к ТЗ, п.3)
-- =========================================================================
-- Публикуем таблицы, по которым карте нужны live-обновления между несколькими
-- одновременно работающими пользователями. RLS-политики выше применяются и здесь:
-- клиент получит только те изменения, которые ему разрешено читать.
--
-- Publication supabase_realtime создаётся платформой Supabase (hosted и
-- `supabase start`) заранее, но миграция не должна на это жёстко полагаться —
-- блок ниже идемпотентен и не падает ни при повторном прогоне, ни на голом
-- Postgres без Supabase (например в CI).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'boreholes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE boreholes;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'observation_points'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE observation_points;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'measurements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE measurements;
    END IF;
END $$;
