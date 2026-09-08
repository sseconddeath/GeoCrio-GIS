import { cache } from 'react';
import { createClient } from './server';
import type { ProfileRow } from './types';

// cache() дедуплицирует физический запрос к Supabase в пределах одного
// дерева рендера — вызывается и в (main)/layout.tsx (шапка/навигация), и в
// (main)/admin/layout.tsx (гейт), но реально выполнится один раз на запрос.
//
// Используется auth.getUser() (не getSession()) — единственный способ
// подтвердить личность на сервере, верифицируя подпись против Auth-сервера.
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url, created_at')
    .eq('id', user.id)
    .single();

  return profile;
});
