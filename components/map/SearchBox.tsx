'use client';

import { useMemo, useState } from 'react';
import type { MapObjectProperties } from './MapView';

interface SearchBoxProps {
  features: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>[];
  onSelect: (feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>) => void;
}

// Простой поиск по коду объекта. Работает по уже загруженной коллекции —
// сеть не нужна, отклик мгновенный. Для полигона с сотнями объектов
// подходит, для тысяч — заменить на серверный action в Этапе 4/5.
export function SearchBox({ features, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as typeof features;
    return features.filter((f) => f.properties.name.toLowerCase().includes(q)).slice(0, 8);
  }, [features, query]);

  return (
    <div className="absolute left-4 top-4 z-10 w-72 max-w-[calc(100vw-2rem)]">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск объекта по коду…"
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-header focus:outline-none focus:ring-2 focus:ring-header/50"
      />
      {matches.length > 0 ? (
        <ul className="mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {matches.map((feature) => (
            <li key={feature.properties.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(feature);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{feature.properties.name}</span>
                <span className="text-xs uppercase text-gray-400">
                  {feature.properties.type === 'borehole' ? 'скв.' : 'точка'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
