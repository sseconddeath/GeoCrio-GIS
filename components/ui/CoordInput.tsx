'use client';

import { useEffect, useState } from 'react';
import { formatAccuracy, normalizeCoordInput } from '@/lib/coords';

interface CoordInputProps {
  latName: string;
  lngName: string;
  initialLat?: number | string;
  initialLng?: number | string;
  latError?: string;
  lngError?: string;
  // Внешние обработчики — если родителю нужно знать актуальные значения
  // (например, MapWorkspace для показа маркера в новой точке).
  onChange?: (lat: number | null, lng: number | null) => void;
}

// Пара «широта / долгота» с двумя ключевыми фичами полевой работы:
//   1. Нормализация запятой → точки — иначе на русской раскладке пользователь
//      набирает «57,20» и молча получает пустое поле.
//   2. Кнопка «Взять моё GPS» — берёт координаты из geolocation API телефона,
//      показывает accuracy в метрах, чтобы геолог сразу понял, хороший ли
//      сигнал.
// Компонент клиентский, но поля — обычные <input name="…">, поэтому Server
// Action читает их через FormData как раньше.
export function CoordInput({
  latName,
  lngName,
  initialLat,
  initialLng,
  latError,
  lngError,
  onChange,
}: CoordInputProps) {
  const [lat, setLat] = useState<string>(initialLat != null ? String(initialLat) : '');
  const [lng, setLng] = useState<string>(initialLng != null ? String(initialLng) : '');
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Синхронизация: родитель может передать новые initialLat/Lng (например,
  // пользователь кликнул по карте, чтобы уточнить точку) — подхватываем
  // и переписываем поля. GPS-accuracy при этом сбрасываем, чтобы
  // старая точность не вводила в заблуждение.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialLat != null) {
      setLat(String(initialLat));
      setAccuracy(null);
    }
  }, [initialLat]);
  useEffect(() => {
    if (initialLng != null) {
      setLng(String(initialLng));
      setAccuracy(null);
    }
  }, [initialLng]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setLatValue = (raw: string) => {
    const norm = normalizeCoordInput(raw);
    setLat(norm);
    onChange?.(norm === '' ? null : Number(norm), lng === '' ? null : Number(lng));
  };
  const setLngValue = (raw: string) => {
    const norm = normalizeCoordInput(raw);
    setLng(norm);
    onChange?.(lat === '' ? null : Number(lat), norm === '' ? null : Number(norm));
  };

  const takeGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Ваш браузер не поддерживает геолокацию.');
      return;
    }
    setGpsPending(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 5 знаков после точки достаточно для полевой работы (~1 м).
        const latStr = pos.coords.latitude.toFixed(5);
        const lngStr = pos.coords.longitude.toFixed(5);
        setLat(latStr);
        setLng(lngStr);
        setAccuracy(pos.coords.accuracy);
        setGpsPending(false);
        onChange?.(Number(latStr), Number(lngStr));
      },
      (err) => {
        setGpsPending(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Нет разрешения на доступ к геолокации. Разрешите в настройках браузера/телефона.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Не удалось получить позицию (нет сигнала GPS).'
              : 'Не удалось получить координаты, попробуйте ещё раз.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={latName} className="text-sm font-medium text-gray-700">
            Широта
          </label>
          <input
            id={latName}
            name={latName}
            type="text"
            inputMode="decimal"
            required
            value={lat}
            onChange={(e) => setLatValue(e.target.value)}
            placeholder="напр. 57.20123"
            className={`min-h-[44px] rounded-md border px-3 text-base focus:outline-none focus:ring-2 focus:ring-header/50 ${
              latError ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={Boolean(latError)}
          />
          {latError ? <p className="text-sm text-red-600">{latError}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={lngName} className="text-sm font-medium text-gray-700">
            Долгота
          </label>
          <input
            id={lngName}
            name={lngName}
            type="text"
            inputMode="decimal"
            required
            value={lng}
            onChange={(e) => setLngValue(e.target.value)}
            placeholder="напр. 65.60000"
            className={`min-h-[44px] rounded-md border px-3 text-base focus:outline-none focus:ring-2 focus:ring-header/50 ${
              lngError ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={Boolean(lngError)}
          />
          {lngError ? <p className="text-sm text-red-600">{lngError}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={takeGps}
          disabled={gpsPending}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md border border-header/30 bg-header/5 px-3 text-sm font-medium text-header hover:bg-header/10 disabled:opacity-60"
        >
          {gpsPending ? 'Получаю координаты…' : 'Взять моё GPS-местоположение'}
        </button>
        {accuracy != null ? (
          <p className="text-xs text-gray-500">Точность: {formatAccuracy(accuracy)}</p>
        ) : null}
        {gpsError ? <p className="text-xs text-red-600">{gpsError}</p> : null}
        <p className="text-xs text-gray-400">
          Координаты можно ввести вручную (в градусах, через точку или запятую) или
          автоматически с телефона. Также сработает клик по карте.
        </p>
      </div>
    </div>
  );
}
