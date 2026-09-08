import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// Клиент для использования в Client Components ('use client').
// Для Server Components/Actions используется lib/supabase/server.ts.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
