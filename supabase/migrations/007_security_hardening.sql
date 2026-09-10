-- =========================================================================
-- Миграция 007: Устранение уязвимостей и мелких багов, найденных аудитом
-- =========================================================================
--
-- 1. HIGH — Подмена polygon_id в edit_proposals (обход ep_read + auto-apply
--    через 3 голоса на чужую скважину). Ключевая проблема: политика
--    ep_insert проверяла fn_can_read_polygon(polygon_id), но polygon_id
--    приходит от клиента и может НЕ совпадать с реальным полигоном
--    target_id. Атакующий указывал свой публичный полигон в polygon_id
--    и чужой target_id — пропозал попадал в очередь, 3 сообщника
--    голосовали (видят его через свой polygon_id), триггер применял.
--
--    Фикс:
--    (a) INSERT-политика теперь ТРЕБУЕТ, чтобы polygon_id совпадал с
--        реальным polygon_id из target_id.
--    (b) fn_apply_edit_proposal дополнительно проверяет то же (defense
--        in depth: если политику когда-то обойдут через прямой SQL,
--        применение всё равно не сработает не на своём полигоне).
--    (c) Валидация значений (depth_m должен парситься в число, если
--        передан). Раньше атакующий мог вставить depth_m: 'abc' —
--        RLS пропускал, но триггер auto-apply падал с ошибкой из-за
--        NULLIF(...)::DECIMAL, и голоса переставали приниматься.
--
-- 2. LOW/семантика — audit_log.user_id: fn_audit_changes брал created_by
--    из строки, но при UPDATE через принятое предложение изменение
--    делает НЕ автор. В истории видно «автор изменил свою запись»,
--    хотя это на самом деле кто-то другой (Community-approved edit).
--    Фикс: приоритет auth.uid() над денормализованными полями.

BEGIN;

-- =========================================================================
-- 1a. RLS ep_insert теперь проверяет соответствие polygon_id ↔ target_id
-- =========================================================================

DROP POLICY IF EXISTS "ep_insert" ON edit_proposals;
CREATE POLICY "ep_insert" ON edit_proposals FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND proposed_by = auth.uid()
        AND fn_can_read_polygon(polygon_id)
        AND (
            (target_table = 'boreholes' AND EXISTS (
                SELECT 1 FROM boreholes b
                WHERE b.id = target_id
                  AND b.polygon_id = edit_proposals.polygon_id   -- ← ключевая проверка
                  AND NOT b.is_deleted
                  AND b.created_by <> auth.uid()                 -- не свой объект
            ))
            OR
            (target_table = 'observation_points' AND EXISTS (
                SELECT 1 FROM observation_points op
                WHERE op.id = target_id
                  AND op.polygon_id = edit_proposals.polygon_id
                  AND NOT op.is_deleted
                  AND op.created_by <> auth.uid()
            ))
        )
    );

-- Голоса: тот же принцип. Раньше epv_insert только проверял, что
-- голосующий не автор целевой записи; но polygon_id мог быть уже
-- подставленный. Пересобираем через consistency-check.
DROP POLICY IF EXISTS "epv_insert" ON edit_proposal_votes;
CREATE POLICY "epv_insert" ON edit_proposal_votes FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND voter_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM edit_proposals ep
            WHERE ep.id = proposal_id
              AND ep.status = 'pending'
              AND ep.proposed_by <> auth.uid()
              AND fn_can_read_polygon(ep.polygon_id)
              AND (
                  (ep.target_table = 'boreholes' AND EXISTS (
                      SELECT 1 FROM boreholes b
                      WHERE b.id = ep.target_id
                        AND b.polygon_id = ep.polygon_id
                        AND b.created_by <> auth.uid()
                  ))
                  OR
                  (ep.target_table = 'observation_points' AND EXISTS (
                      SELECT 1 FROM observation_points op
                      WHERE op.id = ep.target_id
                        AND op.polygon_id = ep.polygon_id
                        AND op.created_by <> auth.uid()
                  ))
              )
        )
    );

-- =========================================================================
-- 1b. fn_apply_edit_proposal: defense in depth — не применять, если
--     polygon_id пропозала не совпадает с реальным polygon'ом target'а.
--     И приоритет обновления по обеим колонкам (id + polygon_id) —
--     чтобы даже прямой SQL-обход не изменил не-тот полигон.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_apply_edit_proposal(
    p_proposal_id UUID,
    p_bypass_permission BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prop            edit_proposals%ROWTYPE;
    v_can_decide      BOOLEAN;
    v_target_author   UUID;
    v_target_polygon  UUID;
BEGIN
    SELECT * INTO v_prop FROM edit_proposals WHERE id = p_proposal_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Предложение % не найдено', p_proposal_id;
    END IF;
    IF v_prop.status <> 'pending' THEN
        RETURN FALSE;
    END IF;

    -- Резолвим одновременно автора и реальный polygon_id целевой записи.
    IF v_prop.target_table = 'boreholes' THEN
        SELECT created_by, polygon_id INTO v_target_author, v_target_polygon
        FROM boreholes WHERE id = v_prop.target_id AND NOT is_deleted;
    ELSE
        SELECT created_by, polygon_id INTO v_target_author, v_target_polygon
        FROM observation_points WHERE id = v_prop.target_id AND NOT is_deleted;
    END IF;

    -- Если объект удалён / переехал в другой polygon — не применяем.
    -- НЕ RAISE (иначе триггер auto-apply рушит INSERT голосов);
    -- переводим пропозал в rejected с пометкой.
    IF v_target_author IS NULL OR v_target_polygon IS NULL THEN
        UPDATE edit_proposals SET
            status = 'rejected',
            decided_by = NULL,
            decided_at = NOW(),
            decision_note = 'Объект удалён'
        WHERE id = p_proposal_id;
        RETURN FALSE;
    END IF;

    IF v_target_polygon <> v_prop.polygon_id THEN
        UPDATE edit_proposals SET
            status = 'rejected',
            decided_by = NULL,
            decided_at = NOW(),
            decision_note = 'Некорректное соответствие участка (защита от подмены)'
        WHERE id = p_proposal_id;
        RETURN FALSE;
    END IF;

    IF NOT p_bypass_permission THEN
        v_can_decide := (auth.uid() = v_target_author) OR is_admin();
        IF NOT v_can_decide THEN
            RAISE EXCEPTION 'Принимать предложение может только автор объекта или админ';
        END IF;
    END IF;

    IF v_prop.target_table = 'boreholes' THEN
        UPDATE boreholes SET
            code        = COALESCE(v_prop.proposed_data->>'code', code),
            depth_m     = COALESCE(NULLIF(v_prop.proposed_data->>'depth_m', '')::DECIMAL, depth_m),
            soil_type   = CASE
                              WHEN v_prop.proposed_data ? 'soil_type'
                              THEN NULLIF(v_prop.proposed_data->>'soil_type', '')
                              ELSE soil_type
                          END,
            description = CASE
                              WHEN v_prop.proposed_data ? 'description'
                              THEN NULLIF(v_prop.proposed_data->>'description', '')
                              ELSE description
                          END
        WHERE id = v_prop.target_id
          AND polygon_id = v_prop.polygon_id   -- ← защита в WHERE
          AND NOT is_deleted;
    ELSE
        UPDATE observation_points SET
            code        = COALESCE(v_prop.proposed_data->>'code', code),
            point_type  = COALESCE(v_prop.proposed_data->>'point_type', point_type),
            description = CASE
                              WHEN v_prop.proposed_data ? 'description'
                              THEN NULLIF(v_prop.proposed_data->>'description', '')
                              ELSE description
                          END
        WHERE id = v_prop.target_id
          AND polygon_id = v_prop.polygon_id
          AND NOT is_deleted;
    END IF;

    UPDATE edit_proposals SET
        status = 'applied',
        decided_by = COALESCE(decided_by, auth.uid()),
        decided_at = COALESCE(decided_at, NOW())
    WHERE id = p_proposal_id;

    RETURN TRUE;
END;
$$;

-- =========================================================================
-- 1c. Валидация значений в proposed_data (server-side, через CHECK)
-- =========================================================================
-- Отклоняем некастуемый depth_m ещё на этапе INSERT — иначе триггер
-- auto-apply падал бы на 3-м голосе (NULLIF(...)::DECIMAL с 'abc'
-- бросает исключение и голос откатывается). Пусть падает раньше,
-- когда явно виновата форма атакующего.

CREATE OR REPLACE FUNCTION fn_validate_proposal_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.proposed_data ? 'depth_m'
       AND NULLIF(NEW.proposed_data->>'depth_m', '') IS NOT NULL THEN
        BEGIN
            PERFORM (NEW.proposed_data->>'depth_m')::DECIMAL;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'proposed_data.depth_m должно быть числом или пустой строкой';
        END;
        IF (NEW.proposed_data->>'depth_m')::DECIMAL <= 0
           OR (NEW.proposed_data->>'depth_m')::DECIMAL > 500 THEN
            RAISE EXCEPTION 'proposed_data.depth_m вне допустимого диапазона (0..500)';
        END IF;
    END IF;
    IF NEW.proposed_data ? 'soil_type'
       AND NULLIF(NEW.proposed_data->>'soil_type', '') IS NOT NULL
       AND NEW.proposed_data->>'soil_type' NOT IN
           ('clay', 'loam', 'sand', 'gravel', 'peat', 'rock', 'other') THEN
        RAISE EXCEPTION 'proposed_data.soil_type имеет недопустимое значение';
    END IF;
    IF NEW.proposed_data ? 'point_type'
       AND NULLIF(NEW.proposed_data->>'point_type', '') IS NOT NULL
       AND NEW.proposed_data->>'point_type' NOT IN
           ('geological', 'hydrological', 'geomorphological',
            'geocryological', 'vegetation', 'other') THEN
        RAISE EXCEPTION 'proposed_data.point_type имеет недопустимое значение';
    END IF;
    IF NEW.proposed_data ? 'code'
       AND (
           length(trim(NEW.proposed_data->>'code')) = 0
           OR length(NEW.proposed_data->>'code') > 64
       ) THEN
        RAISE EXCEPTION 'proposed_data.code должен быть 1..64 символа';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_proposal_data ON edit_proposals;
CREATE TRIGGER tr_validate_proposal_data BEFORE INSERT OR UPDATE ON edit_proposals
    FOR EACH ROW EXECUTE FUNCTION fn_validate_proposal_data();

-- =========================================================================
-- 2. audit_log.user_id — приоритет auth.uid() над денормализованными
--    полями. При обычной вставке/обновлении своей записи разницы нет
--    (auth.uid() = created_by/measured_by/uploaded_by). Разница
--    проявляется при UPDATE через SECURITY DEFINER — принятое
--    предложение, автоприём по 3 голосам, admin-действия. Теперь в
--    аудите видно, кто именно внёс изменение.
-- =========================================================================

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

    -- Приоритет: auth.uid() (реальный субъект действия) → fallback на
    -- денормализованные поля (для системных INSERT'ов от триггеров).
    v_user_id := COALESCE(
        auth.uid(),
        (v_new ->> 'created_by')::uuid,
        (v_new ->> 'measured_by')::uuid,
        (v_new ->> 'uploaded_by')::uuid,
        (v_old ->> 'created_by')::uuid,
        (v_old ->> 'measured_by')::uuid,
        (v_old ->> 'uploaded_by')::uuid,
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

COMMIT;
