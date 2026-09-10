'use client';

import { useState } from 'react';
import { gpx, kml } from '@tmcw/togeojson';

interface PolygonImportProps {
  onImport: (polygon: GeoJSON.Polygon) => void;
}

// Первый Polygon-feature из FeatureCollection. GPX-треки — LineString,
// поэтому берём первый LineString и замыкаем его в Polygon (стандартный
// сценарий «геолог обошёл территорию по периметру с GPS»).
// togeojson возвращает FeatureCollection<Geometry | null>, стандартный
// тип FeatureCollection ожидает Geometry без null — расширяем сигнатуру.
function extractPolygon(
  collection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>,
): GeoJSON.Polygon | null {
  const polygonFeature = collection.features.find((f) => f.geometry?.type === 'Polygon');
  if (polygonFeature && polygonFeature.geometry?.type === 'Polygon') {
    return polygonFeature.geometry;
  }
  const lineFeature = collection.features.find((f) => f.geometry?.type === 'LineString');
  if (lineFeature && lineFeature.geometry?.type === 'LineString') {
    const coords = lineFeature.geometry.coordinates as [number, number][];
    if (coords.length < 3) return null;
    // Замыкаем контур: если первая ≠ последней, добавляем.
    const first = coords[0];
    const last = coords[coords.length - 1];
    const ring: [number, number][] =
      first[0] === last[0] && first[1] === last[1]
        ? coords
        : [...coords, first];
    return { type: 'Polygon', coordinates: [ring] };
  }
  return null;
}

// GeoJSON — уже JSON. KML/GPX — XML, парсим через DOMParser (доступен
// в браузере, компонент клиентский).
async function parseFile(file: File): Promise<GeoJSON.Polygon | null> {
  const text = await file.text();
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
    const data = JSON.parse(text) as GeoJSON.GeoJSON;
    if (data.type === 'FeatureCollection') return extractPolygon(data);
    if (data.type === 'Feature' && data.geometry.type === 'Polygon') {
      return data.geometry;
    }
    if (data.type === 'Polygon') return data;
    return null;
  }

  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (lower.endsWith('.kml')) return extractPolygon(kml(doc));
  if (lower.endsWith('.gpx')) return extractPolygon(gpx(doc));
  return null;
}

export function PolygonImport({ onImport }: PolygonImportProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const polygon = await parseFile(file);
      if (!polygon) {
        setError('В файле не нашёлся полигон или GPS-трек, который можно замкнуть в контур');
      } else {
        onImport(polygon);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Не удалось прочитать файл: ${e.message}`
          : 'Не удалось прочитать файл',
      );
    } finally {
      setPending(false);
      // сброс, чтобы можно было загрузить тот же файл повторно
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-header/50 hover:bg-gray-100">
        <span className="text-sm font-medium text-header">
          {pending ? 'Обработка…' : 'Загрузить границу из файла'}
        </span>
        <span className="text-xs text-gray-500">GeoJSON, KML или GPX</span>
        <input
          type="file"
          accept=".geojson,.json,.kml,.gpx"
          onChange={handleFile}
          disabled={pending}
          className="sr-only"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
