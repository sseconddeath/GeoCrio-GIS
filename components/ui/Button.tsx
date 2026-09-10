'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-header text-white shadow-sm hover:bg-header/90 hover:shadow-md focus-visible:ring-header/40 active:scale-[0.98]',
  secondary:
    'bg-white text-header border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-gray-400/40 active:scale-[0.98]',
  // Для использования на тёмном фоне (шапка) — не конкурирует по специфичности с primary/secondary.
  ghost:
    'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/50 focus-visible:ring-white/40',
};

// Кнопка ≥44px по высоте (раздел 12 ТЗ: полевые условия, работа в перчатках).
// useFormStatus безопасен вне <form> — просто вернёт pending: false.
// active:scale — микро-отклик на клик (150ms) — приложение ощущается
// живее без нагрузки на производительность.
export function Button({ variant = 'primary', className = '', children, disabled, type, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const isSubmitting = type === 'submit' && pending;

  return (
    <button
      type={type}
      disabled={disabled || isSubmitting}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {isSubmitting ? 'Подождите…' : children}
    </button>
  );
}
