-- =========================================================================
-- Миграция 006: Предложения правок (модель iNaturalist Community Taxon)
-- =========================================================================
--
-- Задача: любой геолог, глядя на чужой объект (скважину или точку
-- наблюдения), может нажать «Предложить изменение» и подать заявку с
-- новыми значениями и пояснением. Автор объекта видит её в «Моих
-- уведомлениях» и решает: принять, отклонить или проигнорировать.
--
-- Пороговый механизм: если ≥3 других геолога (кроме автора объекта и
-- самого автора предложения) отметили «+1 согласен», предложение
-- применяется автоматически. Автор объекта всегда может откатить
-- изменения после этого (через историю → «Восстановить прежнее» — это
-- Этап 6, здесь просто оставляем след в audit_log).
--
-- Ограничение v1: через предложения можно менять только «безобидные»
-- поля — код, глубину, тип грунта/точки, описание. Координаты через
-- proposals не редактируются: это существенное изменение геометрии,
-- его должен делать только автор напрямую (или переделывать через
-- новую скважину). Это сознательно консервативный выбор — избегает
-- ситуации, когда пять человек согласились сдвинуть чужую скважину на
-- 200 м и она перестала соответствовать полевому пикету.
--
-- Работоспособность на локальном Postgres без Supabase: миграция
-- идемпотентна (IF NOT EXISTS / OR REPLACE), auth.uid() уже
-- определена базовой платформой (в тестах — стаб).

BEGIN;

-- =========================================================================
-- 1. Таблицы
-- =========================================================================

CREATE TABLE IF NOT EXISTS edit_proposals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_table   TEXT NOT NULL CHECK (target_table IN ('boreholes', 'observation_points')),
    target_id      UUID NOT NULL,
    -- polygon_id денормализуем сразу, чтобы RLS-политики читали одну
    -- колонку, а не JOIN'или на целевую таблицу (то не работает,
    -- когда объект удалён/переезжает).
    polygon_id     UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    proposed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reason         TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
    -- Плоский JSONB, ключи — из whitelist (см. fn_apply_edit_proposal
    -- ниже). Валидация ключей — тоже там; здесь только базовая проверка
    -- на непустоту.
    proposed_data  JSONB NOT NULL CHECK (jsonb_typeof(proposed_data) = 'object' AND proposed_data <> '{}'::jsonb),
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'accepted', 'rejected', 'applied', 'withdrawn')
    ),
    decided_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    decided_at     TIMESTAMPTZ,
    decision_note  TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_proposals_target
    ON edit_proposals (target_table, target_id, status);
CREATE INDEX IF NOT EXISTS idx_edit_proposals_polygon
    ON edit_proposals (polygon_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_proposals_by
    ON edit_proposals (proposed_by, created_at DESC);

DROP TRIGGER IF EXISTS tr_edit_proposals_ts ON edit_proposals;
CREATE TRIGGER tr_edit_proposals_ts BEFORE UPDATE ON edit_proposals
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TABLE IF NOT EXISTS edit_proposal_votes (
    proposal_id  UUID NOT NULL REFERENCES edit_proposals(id) ON DELETE CASCADE,
    voter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (proposal_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_edit_proposal_votes_proposal
    ON edit_proposal_votes (proposal_id);

-- =========================================================================
-- 2. Helper: whitelist полей и применение предложения
-- =========================================================================
--
-- Единственная точка применения предложения (accept вручную ИЛИ
-- триггер по 3 голосам). SECURITY DEFINER: сама проверяет, что
-- вызывающий имеет право (автор объекта / админ / для авто-приёма —
-- вызвана из триггера с явным флагом bypass_permission=true).
--
-- Пишет UPDATE в целевую таблицу, помечает предложение status='applied'.
-- audit_log-триггер целевой таблицы сохранит diff с
-- new_data / old_data — история покажет «изменение через принятое
-- предложение», а поле decision_note дополнит контекстом.

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
BEGIN
    SELECT * INTO v_prop FROM edit_proposals WHERE id = p_proposal_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Предложение % не найдено', p_proposal_id;
    END IF;
    IF v_prop.status <> 'pending' THEN
        RETURN FALSE;
    END IF;

    IF NOT p_bypass_permission THEN
        -- Резолвим автора целевой записи и проверяем: вызывающий = автор
        -- ИЛИ админ. Соавторы полигона намеренно НЕ могут принимать
        -- чужие предложения — это компетенция автора конкретной записи.
        IF v_prop.target_table = 'boreholes' THEN
            SELECT created_by INTO v_target_author FROM boreholes WHERE id = v_prop.target_id;
        ELSE
            SELECT created_by INTO v_target_author FROM observation_points WHERE id = v_prop.target_id;
        END IF;
        v_can_decide := (auth.uid() = v_target_author) OR is_admin();
        IF NOT v_can_decide THEN
            RAISE EXCEPTION 'Принимать предложение может только автор объекта или админ';
        END IF;
    END IF;

    -- Whitelist полей. Всё, чего нет в списке, тихо игнорируем —
    -- защита от инъекции произвольных ключей в proposed_data.
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
        WHERE id = v_prop.target_id AND NOT is_deleted;
    ELSE
        UPDATE observation_points SET
            code        = COALESCE(v_prop.proposed_data->>'code', code),
            point_type  = COALESCE(v_prop.proposed_data->>'point_type', point_type),
            description = CASE
                              WHEN v_prop.proposed_data ? 'description'
                              THEN NULLIF(v_prop.proposed_data->>'description', '')
                              ELSE description
                          END
        WHERE id = v_prop.target_id AND NOT is_deleted;
    END IF;

    UPDATE edit_proposals SET
        status = 'applied',
        decided_by = COALESCE(decided_by, auth.uid()),
        decided_at = COALESCE(decided_at, NOW())
    WHERE id = p_proposal_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_apply_edit_proposal(UUID, BOOLEAN) TO authenticated;

-- =========================================================================
-- 3. Триггер авто-приёма по порогу голосов
-- =========================================================================

-- Порог сообщества: 3 согласия от других геологов (не автор объекта и
-- не автор предложения — их фильтруем в RLS на vote INSERT).
CREATE OR REPLACE FUNCTION fn_check_proposal_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM edit_proposals WHERE id = NEW.proposal_id;
    IF v_status <> 'pending' THEN
        RETURN NEW;
    END IF;
    SELECT COUNT(*) INTO v_count FROM edit_proposal_votes WHERE proposal_id = NEW.proposal_id;
    IF v_count >= 3 THEN
        PERFORM fn_apply_edit_proposal(NEW.proposal_id, TRUE);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_edit_proposal_threshold ON edit_proposal_votes;
CREATE TRIGGER tr_edit_proposal_threshold AFTER INSERT ON edit_proposal_votes
    FOR EACH ROW EXECUTE FUNCTION fn_check_proposal_threshold();

-- =========================================================================
-- 4. Отзыв предложения (автором предложения) и решения (автор
--    объекта / админ) — обёрнуты в SECURITY DEFINER RPC для чистоты
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_reject_edit_proposal(
    p_proposal_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prop          edit_proposals%ROWTYPE;
    v_target_author UUID;
BEGIN
    SELECT * INTO v_prop FROM edit_proposals WHERE id = p_proposal_id FOR UPDATE;
    IF NOT FOUND OR v_prop.status <> 'pending' THEN
        RETURN FALSE;
    END IF;
    IF v_prop.target_table = 'boreholes' THEN
        SELECT created_by INTO v_target_author FROM boreholes WHERE id = v_prop.target_id;
    ELSE
        SELECT created_by INTO v_target_author FROM observation_points WHERE id = v_prop.target_id;
    END IF;
    IF NOT (auth.uid() = v_target_author OR is_admin()) THEN
        RAISE EXCEPTION 'Отклонить предложение может только автор объекта или админ';
    END IF;
    UPDATE edit_proposals SET
        status = 'rejected',
        decided_by = auth.uid(),
        decided_at = NOW(),
        decision_note = p_note
    WHERE id = p_proposal_id;
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_reject_edit_proposal(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION fn_withdraw_edit_proposal(p_proposal_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prop edit_proposals%ROWTYPE;
BEGIN
    SELECT * INTO v_prop FROM edit_proposals WHERE id = p_proposal_id FOR UPDATE;
    IF NOT FOUND OR v_prop.status <> 'pending' THEN
        RETURN FALSE;
    END IF;
    IF v_prop.proposed_by <> auth.uid() AND NOT is_admin() THEN
        RAISE EXCEPTION 'Отозвать предложение может только его автор или админ';
    END IF;
    UPDATE edit_proposals SET status = 'withdrawn', updated_at = NOW()
    WHERE id = p_proposal_id;
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_withdraw_edit_proposal(UUID) TO authenticated;

-- =========================================================================
-- 5. RLS
-- =========================================================================

ALTER TABLE edit_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_proposal_votes ENABLE ROW LEVEL SECURITY;

-- Читать предложения — те же, кто читает полигон объекта.
DROP POLICY IF EXISTS "ep_read" ON edit_proposals;
CREATE POLICY "ep_read" ON edit_proposals FOR SELECT
    USING (fn_can_read_polygon(polygon_id));

-- Создавать предложение — любой авторизованный, кто МОЖЕТ ЧИТАТЬ
-- полигон (публичный или свой/соавторский), но НЕ автор целевой
-- записи (у автора есть прямая правка) и обязательно с proposed_by =
-- auth.uid(). Проверку «не автор записи» делаем через EXISTS —
-- политика WITH CHECK работает на INSERT.
DROP POLICY IF EXISTS "ep_insert" ON edit_proposals;
CREATE POLICY "ep_insert" ON edit_proposals FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND proposed_by = auth.uid()
        AND fn_can_read_polygon(polygon_id)
        AND NOT EXISTS (
            SELECT 1 FROM boreholes b
            WHERE target_table = 'boreholes'
              AND b.id = target_id AND b.created_by = auth.uid()
        )
        AND NOT EXISTS (
            SELECT 1 FROM observation_points op
            WHERE target_table = 'observation_points'
              AND op.id = target_id AND op.created_by = auth.uid()
        )
    );

-- UPDATE через прямую политику НЕ разрешаем — только через RPC
-- fn_apply_edit_proposal / fn_reject_edit_proposal / fn_withdraw
-- (обходят RLS через SECURITY DEFINER, проверяя права сами). Так
-- изолируем бизнес-логику от прямых обновлений с фронта.

-- Голоса: читать — все, кто может читать полигон предложения; писать
-- (голосовать) — любой, кроме автора предложения и автора целевой
-- записи. Одна запись на пару (proposal_id, voter_id) — гарантирует PK.
DROP POLICY IF EXISTS "epv_read" ON edit_proposal_votes;
CREATE POLICY "epv_read" ON edit_proposal_votes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM edit_proposals ep
        WHERE ep.id = proposal_id AND fn_can_read_polygon(ep.polygon_id)
    ));

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
              AND NOT EXISTS (
                  SELECT 1 FROM boreholes b
                  WHERE ep.target_table = 'boreholes'
                    AND b.id = ep.target_id AND b.created_by = auth.uid()
              )
              AND NOT EXISTS (
                  SELECT 1 FROM observation_points op
                  WHERE ep.target_table = 'observation_points'
                    AND op.id = ep.target_id AND op.created_by = auth.uid()
              )
        )
    );

-- Отозвать голос (передумал) — свой единственный.
DROP POLICY IF EXISTS "epv_delete" ON edit_proposal_votes;
CREATE POLICY "epv_delete" ON edit_proposal_votes FOR DELETE
    USING (voter_id = auth.uid());

-- Явные GRANT для роли authenticated. В Supabase-hosted среде это
-- обычно делается автоматически на новые таблицы, но полагаться на это
-- нельзя (self-hosted, локальный тест-стенд). RLS остаётся главной
-- защитой — GRANT просто открывает access к таблице, а policies уже
-- решают, какие строки видны/меняются.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE edit_proposals TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE edit_proposal_votes TO authenticated;

COMMIT;
