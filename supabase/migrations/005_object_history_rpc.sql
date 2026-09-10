-- =========================================================================
-- Миграция 005: RPC fn_object_history для показа истории изменений в UI
-- =========================================================================
--
-- Задача: показать «Историю» на карточке скважины/точки/замера в UI (кто и
-- когда что менял) — фича Этапа 5.2.
--
-- Проблема: audit_log имеет RLS-политику "al_read" USING (is_admin()) —
-- обычные геологи не могут читать таблицу напрямую. Расширять RLS на
-- audit_log per-row сложно и дорого (аудит-строки не хранят polygon_id).
--
-- Решение: SECURITY DEFINER функция fn_object_history(table, record_id),
-- которая сама резолвит polygon_id из целевой таблицы, проверяет право
-- fn_can_read_polygon и только тогда возвращает записи. Совместимо с
-- нашей единой моделью прав (автор/соавтор/публичный/админ).
--
-- ВАЖНО: SET search_path=public обязателен, иначе SECURITY DEFINER
-- уязвим к перехвату функций через search_path (Supabase best practice).

BEGIN;

CREATE OR REPLACE FUNCTION fn_object_history(
    p_table TEXT,
    p_record_id UUID
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_name TEXT,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_polygon_id UUID;
BEGIN
    -- Резолвим polygon_id из целевой таблицы. Если запись не найдена
    -- (могла быть уже удалена или id мусорный) — возвращаем пусто.
    IF p_table = 'boreholes' THEN
        SELECT polygon_id INTO v_polygon_id
        FROM boreholes WHERE boreholes.id = p_record_id;
    ELSIF p_table = 'observation_points' THEN
        SELECT polygon_id INTO v_polygon_id
        FROM observation_points WHERE observation_points.id = p_record_id;
    ELSIF p_table = 'measurements' THEN
        SELECT b.polygon_id INTO v_polygon_id
        FROM measurements m
        JOIN boreholes b ON b.id = m.borehole_id
        WHERE m.id = p_record_id;
    ELSIF p_table = 'polygons' THEN
        v_polygon_id := p_record_id;
    ELSE
        -- Явный отказ: не хотим случайно вернуть audit-строки, скажем,
        -- profiles или sync_conflicts.
        RAISE EXCEPTION 'fn_object_history: table % not supported', p_table;
    END IF;

    IF v_polygon_id IS NULL OR NOT fn_can_read_polygon(v_polygon_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        al.id,
        al.user_id,
        p.full_name,
        al.action,
        al.old_data,
        al.new_data,
        al.created_at
    FROM audit_log al
    LEFT JOIN profiles p ON p.id = al.user_id
    WHERE al.table_name = p_table
      AND al.record_id = p_record_id
    ORDER BY al.created_at DESC
    LIMIT 200;
END;
$$;

-- Даём права вызова аутентифицированным пользователям. Внутри функция
-- сама проверит fn_can_read_polygon и ничего не вернёт при отсутствии
-- права.
GRANT EXECUTE ON FUNCTION fn_object_history(TEXT, UUID) TO authenticated;

COMMIT;
