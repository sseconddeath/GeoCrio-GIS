'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { POINT_TYPE_LABELS } from '@/lib/constants';
import type { ObservationPointRow } from '@/lib/supabase/types';
import {
  createObservationPointAction,
  updateObservationPointAction,
  type ObservationPointActionState,
} from '@/app/(main)/observation-points/actions';

const POINT_TYPE_OPTIONS = (Object.keys(POINT_TYPE_LABELS) as (keyof typeof POINT_TYPE_LABELS)[]).map(
  (value) => ({ value, label: POINT_TYPE_LABELS[value] }),
);

const initialState: ObservationPointActionState = {};

interface ObservationPointFormProps {
  polygonId: string;
  initialLng?: number;
  initialLat?: number;
  point?: ObservationPointRow & { lng?: number; lat?: number };
  onCancel?: () => void;
}

export function ObservationPointForm({
  polygonId,
  initialLng,
  initialLat,
  point,
  onCancel,
}: ObservationPointFormProps) {
  const isEdit = Boolean(point);
  const action = isEdit
    ? updateObservationPointAction.bind(null, point!.id)
    : createObservationPointAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="polygonId" value={polygonId} />
      <FormError message={state.error} />

      <Input
        label="Код точки"
        name="code"
        type="text"
        required
        defaultValue={point?.code}
        placeholder="напр. Тчк-01"
        error={state.fieldErrors?.code}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Долгота"
          name="lng"
          type="number"
          step="any"
          required
          defaultValue={point?.lng ?? initialLng}
          error={state.fieldErrors?.lng}
        />
        <Input
          label="Широта"
          name="lat"
          type="number"
          step="any"
          required
          defaultValue={point?.lat ?? initialLat}
          error={state.fieldErrors?.lat}
        />
      </div>

      <Select
        label="Тип точки"
        name="point_type"
        required
        placeholder="— выберите тип —"
        options={POINT_TYPE_OPTIONS}
        defaultValue={point?.point_type ?? ''}
        error={state.fieldErrors?.point_type}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="op_description" className="text-sm font-medium text-gray-700">
          Описание
        </label>
        <textarea
          id="op_description"
          name="description"
          rows={3}
          defaultValue={point?.description ?? ''}
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-header/50"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          {isEdit ? 'Сохранить' : 'Создать точку'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        ) : null}
      </div>
    </form>
  );
}
