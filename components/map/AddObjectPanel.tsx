'use client';

import { useState } from 'react';
import { BoreholeForm } from '@/components/forms/BoreholeForm';
import { ObservationPointForm } from '@/components/forms/ObservationPointForm';

interface AddObjectPanelProps {
  polygonId: string;
  lng: number;
  lat: number;
  onClose: () => void;
}

// Правая выдвижная панель, открывается после клика по свободному месту карты.
// Пользователь выбирает тип создаваемого объекта (скважина / точка), заполняет
// форму и отправляет — Server Action делает INSERT и revalidatePath('/map').
export function AddObjectPanel({ polygonId, lng, lat, onClose }: AddObjectPanelProps) {
  const [kind, setKind] = useState<'borehole' | 'observation_point'>('borehole');

  return (
    // На мобилке — bottom-sheet: занимает низ экрана, сверху остаётся видна
    // часть карты. На десктопе (md+) — плавающая панель справа сверху.
    <div
      className="
        absolute z-20 flex flex-col overflow-hidden border border-gray-200 bg-white shadow-lg
        inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl
        md:inset-auto md:right-4 md:top-4 md:bottom-auto md:w-96 md:max-h-[calc(100vh-6rem)] md:max-w-[calc(100vw-2rem)] md:rounded-lg
      "
    >
      {/* «Ушко» для свайпа — визуальный маркер bottom-sheet, только на
          мобилке. */}
      <div className="flex h-3 items-center justify-center md:hidden" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-gray-300" />
      </div>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">Добавить объект</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Закрыть"
        >
          X
        </button>
      </div>

      <div className="flex border-b border-gray-100">
        <button
          type="button"
          onClick={() => setKind('borehole')}
          className={`flex-1 py-2 text-sm font-medium ${
            kind === 'borehole'
              ? 'border-b-2 border-header text-header'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Скважина
        </button>
        <button
          type="button"
          onClick={() => setKind('observation_point')}
          className={`flex-1 py-2 text-sm font-medium ${
            kind === 'observation_point'
              ? 'border-b-2 border-header text-header'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Точка наблюдения
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-4">
        {kind === 'borehole' ? (
          <BoreholeForm polygonId={polygonId} initialLng={lng} initialLat={lat} onCancel={onClose} />
        ) : (
          <ObservationPointForm
            polygonId={polygonId}
            initialLng={lng}
            initialLat={lat}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
