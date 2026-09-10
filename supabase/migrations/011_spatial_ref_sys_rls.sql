-- =========================================================================
-- Миграция 011: включаем RLS на spatial_ref_sys (справочник PostGIS)
-- =========================================================================
--
-- В миграции 010 включение RLS было обёрнуто в EXCEPTION-блок и, судя
-- по советнику Supabase, ошибка insufficient_privilege была проглочена,
-- поэтому warning остался. Здесь делаем прямыми командами без обёртки —
-- если владения не хватит, ошибка вылезет сразу, и её можно будет
-- диагностировать.
--
-- Про безопасность: в таблице только описания систем координат
-- (WGS84, UTM…). Публичные данные, идентичные в каждом PostGIS-проекте,
-- реального риска утечки нет. RLS включаем, чтобы удовлетворить
-- Security Advisor.
--
-- В Supabase Cloud (с ноября 2023) SQL Editor выполняется от роли
-- postgres, у которой достаточно прав на ALTER TABLE spatial_ref_sys.
-- Если в вашем проекте ownership другой — см. workaround в конце файла.
-- =========================================================================

-- Отдаём права владельца postgres'у на случай, если он не собственник
-- (не мешает, если уже был). Требует роли suparbase_admin или
-- postgres — что и делает SQL Editor.
ALTER TABLE public.spatial_ref_sys OWNER TO postgres;

-- Включаем RLS.
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Read-only политика для всех (anon + authenticated + service_role).
-- Данные публичные — MapLibre/PostGIS-функции постоянно её читают.
DROP POLICY IF EXISTS spatial_ref_sys_select_all ON public.spatial_ref_sys;
CREATE POLICY spatial_ref_sys_select_all
    ON public.spatial_ref_sys FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- INSERT/UPDATE/DELETE не разрешены — только PostGIS-скрипты обновления
-- версий трогают эту таблицу, они запускаются от суперюзера и обходят
-- RLS.

-- =========================================================================
-- WORKAROUND, если ALTER TABLE OWNER падает с insufficient_privilege:
-- =========================================================================
--
-- В некоторых проектах spatial_ref_sys принадлежит supabase_admin. Тогда
-- через SQL Editor владельца не поменять — нужно Support ticket
-- Supabase, либо перенести PostGIS-расширение в отдельную схему
-- extensions (что ломает queries, ссылающиеся на public.geography).
--
-- Практическая альтернатива: warning в Security Advisor можно спокойно
-- игнорировать для spatial_ref_sys — Supabase явно упоминает это как
-- known false positive для PostGIS-таблиц:
--   https://github.com/orgs/supabase/discussions/21617
