'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import {
  createMeasurementAction,
  type MeasurementActionState,
} from '@/app/(main)/measurements/actions';

interface MeasurementFormProps {
  boreholeId: string;
}

const initialState: MeasurementActionState = {};

// Компактная форма добавления замера в профиле скважины. Три поля —
// глубина, температура, дата/время. После успеха форма очищается.
// Дата по умолчанию — «сейчас» (input datetime-local без секунд).
export function MeasurementForm({ boreholeId }: MeasurementFormProps) {
  const [state, formAction, pending] = useActionState(createMeasurementAction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <input type="hidden" name="boreholeId" value={boreholeId} />
      <div className="text-sm font-medium text-gray-900">Добавить замер температуры</div>
      <FormError message={state.error} />
      {state.success ? (
        <p className="text-sm text-green-700">Замер сохранён.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Глубина, м"
          name="depth_m"
          type="number"
          step="0.01"
          min="0.01"
          max="500"
          required
          placeholder="напр. 3.5"
          error={state.fieldErrors?.depth_m}
        />
        <Input
          label="Температура, °C"
          name="temperature_c"
          type="number"
          step="0.1"
          min="-50"
          max="50"
          required
          placeholder="напр. -1.2"
          error={state.fieldErrors?.temperature_c}
        />
        <Input
          label="Дата и время"
          name="measured_at"
          type="datetime-local"
          required
          defaultValue={defaultDateTimeLocal()}
          error={state.fieldErrors?.measured_at}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="m_notes" className="text-sm font-medium text-gray-700">
          Заметки
        </label>
        <textarea
          id="m_notes"
          name="notes"
          rows={2}
          placeholder="Прибор, погода, необычные условия (необязательно)"
          className="min-h-[60px] rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-header/50"
        />
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Сохраняю…' : 'Сохранить замер'}
      </Button>
    </form>
  );
}

// Локальное «сейчас» без секунд для <input type="datetime-local">.
// Не UTC — браузер сам покажет как ввёл. Замер приходит на сервер как
// строка «2026-03-15T14:30», Date.parse трактует её как локальное
// время, и мы сохраняем в TIMESTAMPTZ.
function defaultDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
