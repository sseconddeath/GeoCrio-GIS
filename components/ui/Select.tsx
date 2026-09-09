import type { SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

// Стилизован под Input: та же высота ≥44px, те же рамки/ошибки/label.
export function Select({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={selectId}
        className={`min-h-[44px] rounded-md border bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-header/50 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
