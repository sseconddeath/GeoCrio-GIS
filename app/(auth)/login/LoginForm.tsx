'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { loginAction, type AuthActionState } from '../actions';

const initialState: AuthActionState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <FormError message={state.error} />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Input
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Button type="submit" className="mt-2 w-full">
        Войти
      </Button>
    </form>
  );
}
