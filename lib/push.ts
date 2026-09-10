'use server';

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

// Web Push helper: настраивает VAPID и отправляет уведомление всем
// активным подпискам пользователя. Устаревшие эндпоинты (410/404)
// автоматически удаляем из БД.
//
// ENV:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — публичный ключ (клиент использует
//                                    его при subscribe())
//   VAPID_PRIVATE_KEY             — приватный ключ (только сервер)
//   VAPID_SUBJECT                 — mailto:admin@... контактный адрес
//
// Ключи генерируются один раз: `npx web-push generate-vapid-keys`.

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@geokrio.local';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // куда открыть при клике (по умолчанию — /inbox)
  tag?: string; // группировка уведомлений (одинаковый tag заменяет старое)
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    // VAPID не настроены — тихо игнорируем. Это не ошибка (dev-стенд,
    // забыли добавить env, etc.). Приложение продолжает работать без
    // пушей — inbox + toast всё покажут.
    return;
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  const subs =
    (rows as Array<{ id: string; endpoint: string; p256dh: string; auth: string }> | null) ?? [];
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        // 404/410 = подписка мертва (пользователь снёс приложение,
        // почистил историю, отозвал разрешение). Помечаем на удаление.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead);
  }
}
