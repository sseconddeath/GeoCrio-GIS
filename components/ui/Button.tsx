'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-header text-white hover:bg-header/90',
  secondary: 'bg-white text-header border border-gray-300 hover:bg-gray-50',
  // Для использования на тёмном фоне (шапка) — не конкурирует по специфичности с primary/secondary.
  ghost: 'bg-transparent text-white border border-white/30 hover:bg-white/10',
};

// Кнопка ≥44px по высоте (раздел 12 ТЗ: полевые условия, работа в перчатках).
// useFormStatus безопасен вне <form> — просто вернёт pending: false.
export function Button({ variant = 'primary', className = '', children, disabled, type, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const isSubmitting = type === 'submit' && pending;

  return (
    <button
      type={type}
      disabled={disabled || isSubmitting}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {isSubmitting ? 'Подождите…' : children}
    </button>
  );
}
