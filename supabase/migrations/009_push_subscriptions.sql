-- =========================================================================
-- Миграция 009: подписки Web Push для уведомлений о правках
-- =========================================================================
--
-- Каждый пользователь может подписаться с нескольких устройств (телефон,
-- планшет, компьютер) — храним по одной строке на браузер+устройство.
-- endpoint уникален глобально (URL push-сервиса Google/Mozilla/Apple).
--
-- RLS: только сам пользователь может читать/писать свои подписки. Никто
-- другой не должен видеть чужие endpoint'ы (в них токены сервиса пуша).
-- Серверная отправка идёт через service_role-клиент (в webPush action —
-- он же обходит RLS).

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint     TEXT NOT NULL UNIQUE,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_read" ON push_subscriptions;
CREATE POLICY "ps_read" ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_insert" ON push_subscriptions;
CREATE POLICY "ps_insert" ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_update" ON push_subscriptions;
CREATE POLICY "ps_update" ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_delete" ON push_subscriptions;
CREATE POLICY "ps_delete" ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions TO authenticated;

COMMIT;
