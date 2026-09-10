'use server';

import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';

// Клиент отдаёт нам сериализованный PushSubscription (endpoint + keys) —
// сохраняем в БД. Одинаковый endpoint = один и тот же браузер: если
// пользователь пере-подписался (протух срок), обновим keys/last_seen_at
// через UNIQUE(endpoint) + upsert.
export async function saveSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false, error: translateDbError(error) };
  return { ok: true };
}

export async function deleteSubscriptionAction(
  endpoint: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Требуется вход в систему' };
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);
  if (error) return { ok: false, error: translateDbError(error) };
  return { ok: true };
}
