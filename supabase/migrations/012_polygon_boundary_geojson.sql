-- =========================================================================
-- Миграция 012: boundary_geojson — jsonb-представление границы полигона
-- =========================================================================
--
-- Supabase / PostgREST по умолчанию сериализует PostGIS geometry в EWKB
-- hex-строку («0103000020E6100000...»), а не в GeoJSON. У нас
-- getPolygon делает supabase.from('polygons').select('*') — приложение
-- ждёт GeoJSON.Polygon, получает hex-строку, MapView крашится на
-- polygon.boundary.coordinates[0] ещё до отрисовки границы.
--
-- Для map_objects мы обходим это через .geojson() (RPC-режим PostgREST,
-- возвращающий FeatureCollection). Но для отдельной строки полигона
-- этот трюк работает хуже — проще завести сгенерированное поле
-- boundary_geojson и селектить его напрямую.
--
-- STORED — вычисляется один раз при вставке/обновлении, читается быстро.
-- =========================================================================

ALTER TABLE public.polygons
    ADD COLUMN IF NOT EXISTS boundary_geojson jsonb
    GENERATED ALWAYS AS (ST_AsGeoJSON(boundary)::jsonb) STORED;
