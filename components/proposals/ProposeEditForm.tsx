'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { POINT_TYPE_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';
import {
  createEditProposalAction,
  type EditProposalActionState,
} from '@/app/(main)/proposals/actions';

interface ProposeEditFormProps {
  targetTable: 'boreholes' | 'observation_points';
  targetId: string;
  polygonId: string;
  // Текущие значения — для placeholder'ов в форме, чтобы пользователь
  // видел «что менять». Поля, которые он не заполнит, не отправятся.
  current: {
    code?: string | null;
    depth_m?: number | string | null;
    soil_type?: string | null;
    point_type?: string | null;
    description?: string | null;
  };
}

const initialState: EditProposalActionState = {};

const SOIL_OPTS = (Object.keys(SOIL_TYPE_LABELS) as (keyof typeof SOIL_TYPE_LABELS)[]).map((v) => ({
  value: v,
  label: SOIL_TYPE_LABELS[v],
}));
const POINT_OPTS = (Object.keys(POINT_TYPE_LABELS) as (keyof typeof POINT_TYPE_LABELS)[]).map((v) => ({
  value: v,
  label: POINT_TYPE_LABELS[v],
}));

// Форма предложения правки. Разворачивается кнопкой на карточке чужого
// объекта. Показывает только те поля, которые вообще разрешено менять
// через предложение (для скважины — code/depth/soil_type/description;
// для точки — code/point_type/description). Координаты сюда не входят
// сознательно — см. миграцию 006.
export function ProposeEditForm({
  targetTable,
  targetId,
  polygonId,
  current,
}: ProposeEditFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEditProposalAction, initialState);
  const { showToast } = useToast();

  useEffect(() => {
    if (!state.success) return;
    showToast({
      kind: 'success',
      message: 'Предложение отправлено. Автор объекта увидит его в разделе «Мои уведомления».',
    });
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [state.success, showToast]);

  useEffect(() => {
    if (state.error) showToast({ kind: 'error', message: state.error });
  }, [state.error, showToast]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[36px] items-center rounded-md border border-header/40 bg-white px-3 text-sm font-medium text-header hover:bg-header/5"
      >
        Предложить правку
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-header/30 bg-white p-4"
    >
      <input type="hidden" name="targetTable" value={targetTable} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="polygonId" value={polygonId} />

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-gray-900">Предложить изменение</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      <p className="text-xs text-gray-600">
        Автор объекта увидит предложение и решит. Если ещё 3 геолога согласятся — правка
        применится автоматически. Координаты через предложения не меняются.
      </p>

      <FormError message={state.error} />

      <Input
        label="Пояснение (обязательно)"
        name="reason"
        type="text"
        required
        placeholder="Напр. Опечатка в коде: должно быть Скв-001"
        error={state.fieldErrors?.reason}
      />

      <Input
        label="Код"
        name="code"
        type="text"
        defaultValue=""
        placeholder={current.code ? `сейчас: ${current.code}` : 'без изменений'}
        error={state.fieldErrors?.code}
      />

      {targetTable === 'boreholes' ? (
        <>
          <Input
            label="Глубина, м"
            name="depth_m"
            type="number"
            step="0.01"
            min="0.01"
            max="500"
            defaultValue=""
            placeholder={current.depth_m != null ? `сейчас: ${current.depth_m}` : 'без изменений'}
            error={state.fieldErrors?.depth_m}
          />
          <Select
            label="Тип грунта"
            name="soil_type"
            placeholder={current.soil_type ? `сейчас: ${SOIL_TYPE_LABELS[current.soil_type as keyof typeof SOIL_TYPE_LABELS] ?? current.soil_type}` : 'без изменений'}
            options={SOIL_OPTS}
            defaultValue=""
            error={state.fieldErrors?.soil_type}
          />
        </>
      ) : (
        <Select
          label="Тип точки"
          name="point_type"
          placeholder={current.point_type ? `сейчас: ${POINT_TYPE_LABELS[current.point_type as keyof typeof POINT_TYPE_LABELS] ?? current.point_type}` : 'без изменений'}
          options={POINT_OPTS}
          defaultValue=""
          error={state.fieldErrors?.point_type}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="prop_description" className="text-sm font-medium text-gray-700">
          Описание
        </label>
        <textarea
          id="prop_description"
          name="description"
          rows={2}
          placeholder={current.description ? `сейчас: ${current.description}` : 'без изменений'}
          className="min-h-[60px] rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-header/50"
        />
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Отправляю…' : 'Отправить предложение'}
      </Button>
    </form>
  );
}
