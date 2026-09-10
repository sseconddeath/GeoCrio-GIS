-- =========================================================================
-- Миграция 008: добавить photos в realtime-публикацию
-- =========================================================================
--
-- RealtimeRefresh теперь подписан не только на boreholes/observation_points
-- (для реалтайм-обновления карты), но и на measurements и photos —
-- измерения меняют вычисляемый permafrost_status (цвет маркера), фото
-- меняют счётчик в статистике. measurements уже были в publication из
-- 001, photos — нет; добавляем идемпотентно.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'photos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE photos;
    END IF;
END $$;

COMMIT;
