'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { CoordInput } from '@/components/ui/CoordInput';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SOIL_TYPE_LABELS } from '@/lib/constants';
import type { BoreholeRow } from '@/lib/supabase/types';
import {
  createBoreholeAction,
  updateBoreholeAction,
  type BoreholeActionState,
} from '@/app/(main)/boreholes/actions';

const SOIL_TYPE_OPTIONS = (Object.keys(SOIL_TYPE_LABELS) as (keyof typeof SOIL_TYPE_LABELS)[]).map(
  (value) => ({ value, label: SOIL_TYPE_LABELS[value] }),
);

const initialState: BoreholeActionState = {};

interface BoreholeFormProps {
  polygonId: string;
  initialLng?: number;
  initialLat?: number;
  borehole?: BoreholeRow & { lng?: number; lat?: number };
  onCancel?: () => void;
}

// В create-режиме координаты приходят из клика по карте (initialLng/Lat),
// в edit-режиме — из уже сохранённого объекта (borehole.lng/lat, вычисляемые
// на сервере из feature.geometry.coordinates).
export function BoreholeForm({ polygonId, initialLng, initialLat, borehole, onCancel }: BoreholeFormProps) {
  const isEdit = Boolean(borehole);
  const action = isEdit
    ? updateBoreholeAction.bind(null, borehole!.id)
    : createBoreholeAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="polygonId" value={polygonId} />
      <FormError message={state.error} />

      <Input
        label="Код скважины"
        name="code"
        type="text"
        required
        defaultValue={borehole?.code}
        placeholder="напр. Скв-01"
        error={state.fieldErrors?.code}
      />

      <CoordInput
        latName="lat"
        lngName="lng"
        initialLat={borehole?.lat ?? initialLat}
        initialLng={borehole?.lng ?? initialLng}
        latError={state.fieldErrors?.lat}
        lngError={state.fieldErrors?.lng}
      />

      <Input
        label="Глубина, м"
        name="depth_m"
        type="number"
        step="0.01"
        min="0.01"
        max="500"
        defaultValue={borehole?.depth_m ?? ''}
        error={state.fieldErrors?.depth_m}
      />

      <Select
        label="Тип грунта"
        name="soil_type"
        placeholder="— не указан —"
        options={SOIL_TYPE_OPTIONS}
        defaultValue={borehole?.soil_type ?? ''}
        error={state.fieldErrors?.soil_type}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={borehole?.description ?? ''}
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-header/50"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          {isEdit ? 'Сохранить' : 'Создать скважину'}
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
