'use client';

import { CheckCircle2, Lock, Mail, User, UserPlus } from 'lucide-react';
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
      <div
        role="status"
        className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
      >
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" aria-hidden />
        <span>{state.success}</span>
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
        placeholder="Иванов Иван"
        error={state.fieldErrors?.fullName}
        leadingIcon={<User size={16} strokeWidth={1.75} />}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        error={state.fieldErrors?.email}
        leadingIcon={<Mail size={16} strokeWidth={1.75} />}
      />
      <Input
        label="Пароль"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Минимум 8 символов"
        error={state.fieldErrors?.password}
        leadingIcon={<Lock size={16} strokeWidth={1.75} />}
      />
      <Input
        label="Повторите пароль"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Повторите пароль"
        error={state.fieldErrors?.passwordConfirm}
        leadingIcon={<Lock size={16} strokeWidth={1.75} />}
      />
      <Button type="submit" className="mt-2 w-full">
        <UserPlus size={16} strokeWidth={2} aria-hidden />
        Зарегистрироваться
      </Button>
    </form>
  );
}
