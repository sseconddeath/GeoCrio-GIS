-- Этап 2.5: превращение приложения из «один зашитый полигон ТИУ» в
-- полноценную мультипользовательскую платформу.
--
-- Что меняем:
-- 1. Любой авторизованный геолог может создать свой полигон
--    (раньше — только is_admin()).
-- 2. Полигоны становятся приватными по умолчанию; автор может поставить
--    флаг is_public — тогда read-only виден всем.
-- 3. Новая таблица polygon_members — соавторы полигона (полноправная
--    команда). Автор приглашает по email.
-- 4. RLS всех «дочерних» таблиц (boreholes/observation_points/
--    measurements/photos/field_notes) переписывается через helper-функции
--    fn_can_read_polygon/fn_can_write_polygon, которые инкапсулируют
--    новую модель «автор + соавторы + публичность».
-- 5. RPC invite_polygon_member для приглашения по email.
-- 6. Аудит-триггер на polygons (в 001 его не было — важно для
--    отслеживания смены публичности и передачи полигонов).
-- 7. Удаляется старый seed-полигон ТИУ (он «принадлежит непонятно кому»
--    в новой модели).

BEGIN;

-- =========================================================================
-- 1. Схема: колонка is_public + таблица polygon_members
-- =========================================================================

ALTER TABLE polygons
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_polygons_public
    ON polygons (created_at DESC) WHERE is_public;
CREATE INDEX IF NOT EXISTS idx_polygons_owner
    ON polygons (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS polygon_members (
    polygon_id  UUID NOT NULL REFERENCES polygons(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (polygon_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_polygon_members_user
    ON polygon_members (user_id, polygon_id);

ALTER TABLE polygon_members ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. Helper-функции доступа к полигону
-- =========================================================================
-- Инкапсулируют логику «может ли пользователь читать/писать в полигон»,
-- чтобы политики boreholes/observation_points/... не дублировали её.
-- SECURITY DEFINER + фиксированный search_path — тот же паттерн, что у
-- is_admin() (см. миграцию 001).

CREATE OR REPLACE FUNCTION fn_can_read_polygon(p_polygon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        auth.uid() IS NOT NULL AND (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM polygons p
                WHERE p.id = p_polygon_id
                  AND (p.is_public OR p.created_by = auth.uid())
            ) OR
            EXISTS (
                SELECT 1 FROM polygon_members pm
                WHERE pm.polygon_id = p_polygon_id AND pm.user_id = auth.uid()
            )
        );
$$;

CREATE OR REPLACE FUNCTION fn_can_write_polygon(p_polygon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        auth.uid() IS NOT NULL AND (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM polygons p
                WHERE p.id = p_polygon_id AND p.created_by = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM polygon_members pm
                WHERE pm.polygon_id = p_polygon_id AND pm.user_id = auth.uid()
            )
        );
$$;

-- Отдельная функция «пользователь — владелец полигона» (для операций,
-- которые доступны только автору, а не соавтору: приглашение членов,
-- смена публичности, удаление полигона).
CREATE OR REPLACE FUNCTION fn_is_polygon_owner(p_polygon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        auth.uid() IS NOT NULL AND (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM polygons p
                WHERE p.id = p_polygon_id AND p.created_by = auth.uid()
            )
        );
$$;

-- =========================================================================
-- 3. RPC для приглашения соавтора по email
-- =========================================================================
-- Возвращает status:
--   'invited'         — пользователь найден и добавлен
--   'already_member'  — уже состоит в команде
--   'not_registered'  — email не зарегистрирован (UI покажет «попросите
--                       коллегу зарегистрироваться»)
--   'forbidden'       — вызывающий не владелец полигона
-- И user_id если найден.

CREATE OR REPLACE FUNCTION invite_polygon_member(
    p_polygon_id UUID,
    p_email TEXT
)
RETURNS TABLE (status TEXT, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user UUID;
BEGIN
    IF NOT fn_is_polygon_owner(p_polygon_id) THEN
        RETURN QUERY SELECT 'forbidden'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    SELECT u.id INTO v_target_user
        FROM auth.users u
        WHERE lower(u.email) = lower(trim(p_email))
        LIMIT 1;

    IF v_target_user IS NULL THEN
        RETURN QUERY SELECT 'not_registered'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM polygon_members pm
        WHERE pm.polygon_id = p_polygon_id AND pm.user_id = v_target_user
    ) OR EXISTS (
        SELECT 1 FROM polygons p
        WHERE p.id = p_polygon_id AND p.created_by = v_target_user
    ) THEN
        RETURN QUERY SELECT 'already_member'::TEXT, v_target_user;
        RETURN;
    END IF;

    INSERT INTO polygon_members (polygon_id, user_id, invited_by)
        VALUES (p_polygon_id, v_target_user, auth.uid());

    RETURN QUERY SELECT 'invited'::TEXT, v_target_user;
END;
$$;

-- =========================================================================
-- 4. Аудит-триггер на polygons (не был создан в 001)
-- =========================================================================
CREATE TRIGGER tr_audit_polygons
    AFTER INSERT OR UPDATE OR DELETE ON polygons
    FOR EACH ROW EXECUTE FUNCTION fn_audit_changes();

-- polygon_members имеет составной PK (polygon_id + user_id) без колонки `id`,
-- а fn_audit_changes требует id для audit_log.record_id (NOT NULL).
-- Аудит для этой таблицы вынесем в отдельный механизм позже (если
-- потребуется — сейчас приглашения/удаления команды это малый поток,
-- в MVP можно обойтись без отдельного лога).

-- =========================================================================
-- 5. Пересборка RLS-политик
-- =========================================================================

-- POLYGONS ------------------------------------------------------------------
DROP POLICY IF EXISTS "polygons_read"   ON polygons;
DROP POLICY IF EXISTS "polygons_insert" ON polygons;
DROP POLICY IF EXISTS "polygons_update" ON polygons;
DROP POLICY IF EXISTS "polygons_delete" ON polygons;

-- Читаем свои + публичные + те, где мы соавторы + всё для админа.
CREATE POLICY "polygons_read" ON polygons FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
        is_admin()
        OR is_public
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM polygon_members pm
            WHERE pm.polygon_id = polygons.id AND pm.user_id = auth.uid()
        )
    )
);
-- Создать полигон может любой авторизованный, с автоматической
-- привязкой created_by = uid (клиент обязан передать).
CREATE POLICY "polygons_insert" ON polygons FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
-- Обновлять — автор или соавтор (соавтор может править имя/описание,
-- но не сможет поменять is_public — это ограничивается на клиенте и в
-- action; на уровне RLS достаточно проверки на членство в команде).
CREATE POLICY "polygons_update" ON polygons FOR UPDATE
    USING (fn_can_write_polygon(id));
-- Удаление — только владелец или админ.
CREATE POLICY "polygons_delete" ON polygons FOR DELETE
    USING (fn_is_polygon_owner(id));

-- POLYGON_MEMBERS -----------------------------------------------------------
-- Читать список: соавторы полигона + владелец + сам приглашённый + админ.
CREATE POLICY "pm_read" ON polygon_members FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
        is_admin()
        OR user_id = auth.uid()
        OR fn_can_read_polygon(polygon_id)
    )
);
-- Приглашать и удалять членов — только владелец через RPC (SECURITY
-- DEFINER); поэтому политик INSERT/DELETE для обычных ролей нет.
-- Владелец, вызвавший RPC от своего имени, тоже пройдёт: RPC работает
-- под DEFINER (postgres) и обходит RLS. Явно запрещать не нужно.
-- Разрешим DELETE через политику: владельцу — удалять любого,
-- пользователю — сам себя (выйти из команды).
CREATE POLICY "pm_delete" ON polygon_members FOR DELETE USING (
    fn_is_polygon_owner(polygon_id) OR user_id = auth.uid()
);

-- BOREHOLES -----------------------------------------------------------------
DROP POLICY IF EXISTS "bh_read"   ON boreholes;
DROP POLICY IF EXISTS "bh_insert" ON boreholes;
DROP POLICY IF EXISTS "bh_update" ON boreholes;
DROP POLICY IF EXISTS "bh_delete" ON boreholes;

CREATE POLICY "bh_read"   ON boreholes FOR SELECT
    USING (fn_can_read_polygon(polygon_id));
CREATE POLICY "bh_insert" ON boreholes FOR INSERT WITH CHECK (
    auth.uid() = created_by AND fn_can_write_polygon(polygon_id)
);
CREATE POLICY "bh_update" ON boreholes FOR UPDATE
    USING (fn_can_write_polygon(polygon_id));
CREATE POLICY "bh_delete" ON boreholes FOR DELETE
    USING (fn_can_write_polygon(polygon_id));
    -- физическое DELETE теперь доступно команде полигона; soft delete
    -- (UPDATE is_deleted=true) — тоже. Ранее только is_admin() —
    -- слишком строго для командной работы.

-- OBSERVATION_POINTS -------------------------------------------------------
DROP POLICY IF EXISTS "op_read"   ON observation_points;
DROP POLICY IF EXISTS "op_insert" ON observation_points;
DROP POLICY IF EXISTS "op_update" ON observation_points;
DROP POLICY IF EXISTS "op_delete" ON observation_points;

CREATE POLICY "op_read"   ON observation_points FOR SELECT
    USING (fn_can_read_polygon(polygon_id));
CREATE POLICY "op_insert" ON observation_points FOR INSERT WITH CHECK (
    auth.uid() = created_by AND fn_can_write_polygon(polygon_id)
);
CREATE POLICY "op_update" ON observation_points FOR UPDATE
    USING (fn_can_write_polygon(polygon_id));
CREATE POLICY "op_delete" ON observation_points FOR DELETE
    USING (fn_can_write_polygon(polygon_id));

-- MEASUREMENTS -------------------------------------------------------------
-- У measurements нет прямого polygon_id — доступ определяется через
-- boreholes(polygon_id). SELECT существующей записи разрешён любому, кто
-- может читать соответствующий полигон.
DROP POLICY IF EXISTS "ms_read"   ON measurements;
DROP POLICY IF EXISTS "ms_insert" ON measurements;
DROP POLICY IF EXISTS "ms_update" ON measurements;
DROP POLICY IF EXISTS "ms_delete" ON measurements;

CREATE POLICY "ms_read" ON measurements FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = measurements.borehole_id
          AND fn_can_read_polygon(b.polygon_id)
    )
);
CREATE POLICY "ms_insert" ON measurements FOR INSERT WITH CHECK (
    auth.uid() = measured_by AND EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = measurements.borehole_id
          AND fn_can_write_polygon(b.polygon_id)
    )
);
CREATE POLICY "ms_update" ON measurements FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = measurements.borehole_id
          AND fn_can_write_polygon(b.polygon_id)
    )
);
CREATE POLICY "ms_delete" ON measurements FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = measurements.borehole_id
          AND fn_can_write_polygon(b.polygon_id)
    )
);

-- PHOTOS -------------------------------------------------------------------
-- Фото полиморфное (borehole_id / observation_point_id / polygon_id).
-- Достаточно проверить любую из трёх ссылок, ведущую на полигон
-- с разрешённым доступом.
DROP POLICY IF EXISTS "ph_read"   ON photos;
DROP POLICY IF EXISTS "ph_insert" ON photos;
DROP POLICY IF EXISTS "ph_update" ON photos;
DROP POLICY IF EXISTS "ph_delete" ON photos;

CREATE POLICY "ph_read" ON photos FOR SELECT USING (
    (polygon_id IS NOT NULL AND fn_can_read_polygon(polygon_id))
    OR EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = photos.borehole_id
          AND fn_can_read_polygon(b.polygon_id)
    )
    OR EXISTS (
        SELECT 1 FROM observation_points op
        WHERE op.id = photos.observation_point_id
          AND fn_can_read_polygon(op.polygon_id)
    )
);
CREATE POLICY "ph_insert" ON photos FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND (
        (polygon_id IS NOT NULL AND fn_can_write_polygon(polygon_id))
        OR EXISTS (
            SELECT 1 FROM boreholes b
            WHERE b.id = photos.borehole_id
              AND fn_can_write_polygon(b.polygon_id)
        )
        OR EXISTS (
            SELECT 1 FROM observation_points op
            WHERE op.id = photos.observation_point_id
              AND fn_can_write_polygon(op.polygon_id)
        )
    )
);
CREATE POLICY "ph_update" ON photos FOR UPDATE USING (
    (polygon_id IS NOT NULL AND fn_can_write_polygon(polygon_id))
    OR EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = photos.borehole_id
          AND fn_can_write_polygon(b.polygon_id)
    )
    OR EXISTS (
        SELECT 1 FROM observation_points op
        WHERE op.id = photos.observation_point_id
          AND fn_can_write_polygon(op.polygon_id)
    )
);
CREATE POLICY "ph_delete" ON photos FOR DELETE USING (
    (polygon_id IS NOT NULL AND fn_can_write_polygon(polygon_id))
    OR EXISTS (
        SELECT 1 FROM boreholes b
        WHERE b.id = photos.borehole_id
          AND fn_can_write_polygon(b.polygon_id)
    )
    OR EXISTS (
        SELECT 1 FROM observation_points op
        WHERE op.id = photos.observation_point_id
          AND fn_can_write_polygon(op.polygon_id)
    )
);

-- FIELD_NOTES --------------------------------------------------------------
DROP POLICY IF EXISTS "fn_read"   ON field_notes;
DROP POLICY IF EXISTS "fn_insert" ON field_notes;
DROP POLICY IF EXISTS "fn_update" ON field_notes;
DROP POLICY IF EXISTS "fn_delete" ON field_notes;

CREATE POLICY "fn_read" ON field_notes FOR SELECT
    USING (fn_can_read_polygon(polygon_id));
CREATE POLICY "fn_insert" ON field_notes FOR INSERT WITH CHECK (
    auth.uid() = created_by AND fn_can_write_polygon(polygon_id)
);
CREATE POLICY "fn_update" ON field_notes FOR UPDATE
    USING (fn_can_write_polygon(polygon_id));
CREATE POLICY "fn_delete" ON field_notes FOR DELETE
    USING (fn_can_write_polygon(polygon_id));

-- =========================================================================
-- 6. Убрать старый seed-полигон ТИУ
-- =========================================================================
-- В новой модели «безымянный» seed без created_by выглядит как чужой
-- ничей полигон. Реальные полигоны теперь заводят пользователи через UI.
DELETE FROM polygons WHERE id = '00000000-0000-0000-0000-000000000001';

COMMIT;
