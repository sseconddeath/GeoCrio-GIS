'use server';

import { redirect } from 'next/navigation';
import type { ZodError } from 'zod';
import { isSafeRedirectTarget } from '@/lib/routes';
import { createClient } from '@/lib/supabase/server';
import { translateAuthError } from '@/lib/supabase/errors';
import { loginSchema, registerSchema } from '@/lib/validation';

export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

export async function loginAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: translateAuthError(error) };
  }

  const redirectToRaw = formData.get('redirectTo');
  const redirectTo =
    typeof redirectToRaw === 'string' && isSafeRedirectTarget(redirectToRaw) ? redirectToRaw : '/map';
  redirect(redirectTo);
}

export async function registerAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();

  // full_name передаётся ТОЛЬКО через options.data — строка в profiles
  // создаётся автоматически триггером on_auth_user_created (Этап 0).
  // Прямой insert/update в profiles отсюда не нужен и будет отклонён RLS.
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return { error: translateAuthError(error) };
  }

  // Anti-enumeration: при повторной регистрации уже существующего email
  // Supabase (с включённым подтверждением почты) не возвращает ошибку, а
  // тихо возвращает "псевдо-успех". Чтобы не раскрывать, зарегистрирован ли
  // email, показываем одно и то же нейтральное сообщение в обоих случаях.
  return {
    success:
      'Если этот email ещё не зарегистрирован, на него отправлено письмо для подтверждения. Проверьте почту и войдите после подтверждения.',
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
