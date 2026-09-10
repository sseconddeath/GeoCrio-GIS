'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useTransition } from 'react';
import { useOffline } from 'next/offline';
import { Button } from '@/components/ui/Button';
import { CoordInput } from '@/components/ui/CoordInput';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { POINT_TYPE_LABELS } from '@/lib/constants';
import { drain, enqueue } from '@/lib/offline/queue';
import type { ObservationPointRow } from '@/lib/supabase/types';
import {
  createObservationPointAction,
  updateObservationPointAction,
  type ObservationPointActionState,
  type ObservationPointQueueInput,
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
  const isOffline = useOffline();
  const [offlineSaving, startOffline] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isOffline) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: ObservationPointQueueInput = {
      polygonId,
      code: String(fd.get('code') ?? '').trim(),
      lat: Number(fd.get('lat')),
      lng: Number(fd.get('lng')),
      point_type: String(fd.get('point_type') ?? ''),
      description: (fd.get('description') as string) || null,
    };
    startOffline(async () => {
      await enqueue(
        isEdit
          ? { kind: 'observation_point:update', data: payload, targetId: point!.id }
          : { kind: 'observation_point:create', data: payload },
      );
      drain().catch(() => {});
      router.push(isEdit ? `/observation-points/${point!.id}` : '/map');
    });
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="polygonId" value={polygonId} />
      <FormError message={state.error} />
      {isOffline ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Нет связи. Точка сохранится локально и отправится, когда сеть вернётся.
        </p>
      ) : null}

      <Input
        label="Код точки"
        name="code"
        type="text"
        required
        defaultValue={point?.code}
        placeholder="напр. Тчк-01"
        error={state.fieldErrors?.code}
      />

      <CoordInput
        latName="lat"
        lngName="lng"
        initialLat={point?.lat ?? initialLat}
        initialLng={point?.lng ?? initialLng}
        latError={state.fieldErrors?.lat}
        lngError={state.fieldErrors?.lng}
      />

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
        <Button type="submit" className="flex-1" disabled={offlineSaving}>
          {offlineSaving
            ? 'Сохраняю локально…'
            : isOffline
              ? isEdit
                ? 'Сохранить локально'
                : 'Создать локально'
              : isEdit
                ? 'Сохранить'
                : 'Создать точку'}
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
