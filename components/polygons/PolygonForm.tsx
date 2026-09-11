'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import type { PolygonRow } from '@/lib/supabase/types';
import {
  createPolygonAction,
  updatePolygonAction,
  type PolygonActionState,
} from '@/app/(main)/polygons/actions';
import { PolygonDrawer } from './PolygonDrawer';
import { PolygonImport } from './PolygonImport';

interface PolygonFormProps {
  polygon?: PolygonRow;
  // Отдельная кнопка «Отмена» — при редактировании возвращает на страницу
  // просмотра, при создании — на список.
  onCancel?: () => void;
}

const initialState: PolygonActionState = {};

export function PolygonForm({ polygon, onCancel }: PolygonFormProps) {
  const isEdit = Boolean(polygon);
  const [boundary, setBoundary] = useState<GeoJSON.Polygon | null>(
    (polygon?.boundary as GeoJSON.Polygon | null) ?? null,
  );
  // Контролируемые поля: React 19 сбрасывает <form action> после submit
  // и uncontrolled Input.value обнуляется — из-за этого при ошибке
  // сервера пользователь терял введённые название/описание.
  const [name, setName] = useState<string>(polygon?.name ?? '');
  const [description, setDescription] = useState<string>(polygon?.description ?? '');
  const [isPublic, setIsPublic] = useState<boolean>(polygon?.is_public ?? false);

  const action = isEdit
    ? updatePolygonAction.bind(null, polygon!.id)
    : createPolygonAction;
  const [state, formAction] = useActionState(action, initialState);

  // Server-action возвращает redirectTo вместо прямого redirect() —
  // тут делаем клиентскую навигацию, когда action ответил успехом.
  const router = useRouter();
  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <Input
        label="Название участка"
        name="name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="напр. Полевые работы 2026, Собь"
        error={state.fieldErrors?.name}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="p_description" className="text-sm font-medium text-gray-700">
          Описание
        </label>
        <textarea
          id="p_description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-header/50"
          placeholder="Кратко: район, цель работ, срок"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Граница участка</span>
          {state.fieldErrors?.boundary ? (
            <span className="text-sm text-red-600">{state.fieldErrors.boundary}</span>
          ) : (
            <span className="text-xs text-gray-500">
              {boundary
                ? `${boundary.coordinates[0].length - 1} вершин`
                : 'ещё не задана'}
            </span>
          )}
        </div>

        <PolygonDrawer initial={boundary} onChange={setBoundary} />

        <PolygonImport onImport={setBoundary} />

        {/* Скрытое поле для сабмита — контейнер сам не отправит GeoJSON.Polygon,
            передаём его сериализованно в JSON. */}
        <input
          type="hidden"
          name="boundary"
          value={boundary ? JSON.stringify(boundary) : ''}
        />
      </div>

      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <input
          type="checkbox"
          name="is_public"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <div>
          <div className="text-sm font-medium text-gray-700">
            Опубликовать для всех геологов
          </div>
          <div className="text-xs text-gray-500">
            Другие пользователи смогут открыть участок и посмотреть данные,
            но менять их — только вы и приглашённые вами соавторы. Публичность
            можно выключить в любой момент.
          </div>
        </div>
      </label>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" disabled={!boundary}>
          {isEdit ? 'Сохранить изменения' : 'Создать участок'}
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
