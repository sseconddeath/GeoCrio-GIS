'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { registerAction, type AuthActionState } from '../actions';

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  if (state.success) {
    return (
      <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Input
        label="Имя и фамилия"
        name="fullName"
        type="text"
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
      />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Input
        label="Пароль"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <Input
        label="Повторите пароль"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <Button type="submit" className="mt-2 w-full">
        Зарегистрироваться
      </Button>
    </form>
  );
}
