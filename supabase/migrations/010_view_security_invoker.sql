-- =========================================================================
-- Миграция 010: закрываем 4 CRITICAL предупреждения Supabase Security Advisor
-- =========================================================================
--
-- 1) SECURITY DEFINER VIEW (3 штуки)
--    Views map_objects / polygon_stats / borehole_temperature_profile
--    создавались от имени суперюзера postgres. По-умолчанию в Postgres
--    view исполняется с правами владельца — это обходит RLS на
--    подлежащих таблицах: любой авторизованный запрос через view
--    получил бы данные всех пользователей.
--
--    Фикс — Postgres 15+ поддерживает флаг security_invoker=true, при
--    котором view выполняется с правами вызывающего, и RLS на boreholes/
--    observation_points/measurements/photos отрабатывает корректно.
--
-- 2) RLS DISABLED IN PUBLIC: spatial_ref_sys
--    Это справочная таблица PostGIS с описаниями систем координат
--    (WGS84 и т.п.). Все данные публичные и одинаковые в каждом
--    PostGIS-проекте, но Supabase требует RLS для любой таблицы в
--    public. Включаем RLS + разрешаем всем читать (INSERT/UPDATE/DELETE
--    не разрешены — таблица наполняется только PostGIS'ом).
--
-- Идемпотентно: миграцию можно прогнать повторно без ошибок.
-- =========================================================================

-- 1. Переводим views в security_invoker
ALTER VIEW public.map_objects SET (security_invoker = true);
ALTER VIEW public.polygon_stats SET (security_invoker = true);
ALTER VIEW public.borehole_temperature_profile SET (security_invoker = true);

-- 2. Включаем RLS на spatial_ref_sys с read-only политикой для всех.
--    IF EXISTS на политику — на случай повторного прогона.
DO $$
BEGIN
    BEGIN
        EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN insufficient_privilege THEN
        -- В некоторых инсталляциях PostGIS-таблица принадлежит не postgres,
        -- и ENABLE RLS требует ownership. Тогда предупреждение остаётся,
        -- но реального риска нет: таблица содержит только справочник СК.
        RAISE NOTICE 'Cannot ENABLE RLS on spatial_ref_sys — not owner. Skipping.';
        RETURN;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'spatial_ref_sys'
          AND policyname = 'spatial_ref_sys_select_all'
    ) THEN
        EXECUTE $POLICY$
            CREATE POLICY spatial_ref_sys_select_all
                ON public.spatial_ref_sys FOR SELECT
                USING (true)
        $POLICY$;
    END IF;
END $$;
