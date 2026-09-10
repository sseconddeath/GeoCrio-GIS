import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  // Опциональная иконка слева — визуально ориентирует поле (Mail, Lock…).
  leadingIcon?: ReactNode;
}

export function Input({
  label,
  error,
  id,
  className = '',
  leadingIcon,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const withIconPadding = leadingIcon ? 'pl-10' : 'px-3';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-gray-400"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`min-h-[44px] w-full rounded-md border bg-white text-base transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-header/40 focus:border-header/60 ${withIconPadding} ${
            error ? 'border-red-400 focus:ring-red-400/40 focus:border-red-500' : 'border-gray-300'
          } ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
