import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

// Клиент для использования в Server Components / Server Actions.
// В Server Component вызов cookies().set() бросает ошибку — это ожидаемо
// (сессию уже обновил middleware.ts на этот запрос), поэтому setAll обёрнут
// в try/catch, чтобы не ронять рендер.
//
// Next.js 16: cookies() из next/headers асинхронна (Promise-based request
// API, начиная с Next 15) — обязателен await, иначе будет получен сам
// Promise вместо cookie store и вызовы getAll()/set() упадут в рантайме.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Вызвано из Server Component без возможности записи cookies — игнорируем.
          }
        },
      },
    }
  );
}
