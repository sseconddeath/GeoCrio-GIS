'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PolygonRow, PolygonStatsRow } from '@/lib/supabase/types';
import { AddObjectPanel } from './AddObjectPanel';
import { LayerPanel, type LayerVisibility } from './LayerPanel';
import { MapView, type MapObjectProperties } from './MapView';
import { Popup } from './Popup';
import { SearchBox } from './SearchBox';

interface MapWorkspaceProps {
  polygon: PolygonRow;
  objects: GeoJSON.FeatureCollection<GeoJSON.Point, MapObjectProperties>;
  stats: PolygonStatsRow | null;
}

// Единственный клиентский корень страницы карты. Дальше вниз по дереву
// монтируются: MapView (императивный MapLibre), LayerPanel (в Sidebar), а
// поверх карты — плавающие Popup / AddObjectPanel / SearchBox.
export function MapWorkspace({ polygon, objects, stats }: MapWorkspaceProps) {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    boreholes: true,
    observationPoints: true,
    polygonBoundary: true,
  });
  const [selectedFeature, setSelectedFeature] = useState<
    GeoJSON.Feature<GeoJSON.Point, MapObjectProperties> | null
  >(null);
  const [addAt, setAddAt] = useState<{ lng: number; lat: number } | null>(null);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);

  const filteredObjects = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, MapObjectProperties>>(
    () => ({
      type: 'FeatureCollection',
      features: objects.features.filter((f) => {
        if (f.properties.type === 'borehole') return visibility.boreholes;
        return visibility.observationPoints;
      }),
    }),
    [objects, visibility.boreholes, visibility.observationPoints],
  );

  const [showSidebar, setShowSidebar] = useState(false);

  const handleMapClick = useCallback((lng: number, lat: number) => {
    setSelectedFeature(null);
    setAddAt({ lng, lat });
    // На мобилке — сразу прячем панель слоёв, чтобы форма создания
    // открывалась поверх свободной карты.
    setShowSidebar(false);
  }, []);

  const handleFeatureClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>) => {
      setAddAt(null);
      setSelectedFeature(feature);
      setShowSidebar(false);
    },
    [],
  );

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full">
      {/* Sidebar — 240px на десктопе, оверлей на планшете/мобилке. */}
      <aside
        className={`${
          showSidebar ? 'absolute inset-y-0 left-0 z-20 w-72 shadow-lg' : 'hidden'
        } shrink-0 border-r border-gray-200 bg-white lg:static lg:z-auto lg:block lg:w-60 lg:shadow-none`}
      >
        <LayerPanel
          polygonName={polygon.name}
          stats={stats}
          visibility={visibility}
          onToggle={(key) => setVisibility((v) => ({ ...v, [key]: !v[key] }))}
        />
      </aside>

      {/* Кнопка "Слои" — только на планшете/мобилке. */}
      <button
        type="button"
        onClick={() => setShowSidebar((v) => !v)}
        className="absolute bottom-20 left-4 z-10 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium shadow-md lg:hidden"
      >
        {showSidebar ? 'Скрыть слои' : 'Слои'}
      </button>

      <div className="relative flex-1">
        <MapView
          polygon={polygon}
          objects={filteredObjects}
          showPolygonBoundary={visibility.polygonBoundary}
          onMapClick={handleMapClick}
          onFeatureClick={handleFeatureClick}
          onCursorMove={(lng, lat) => setCursor({ lng, lat })}
        />

        <SearchBox
          features={filteredObjects.features}
          onSelect={handleFeatureClick}
        />

        {selectedFeature ? (
          <Popup
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
            onEdit={() => {
              const target =
                selectedFeature.properties.type === 'borehole'
                  ? `/boreholes/${selectedFeature.properties.id}/edit`
                  : `/observation-points/${selectedFeature.properties.id}/edit`;
              window.location.href = target;
            }}
          />
        ) : null}

        {addAt ? (
          <AddObjectPanel
            polygonId={polygon.id}
            lng={addAt.lng}
            lat={addAt.lat}
            onClose={() => setAddAt(null)}
          />
        ) : null}

        {/* Координаты курсора */}
        {cursor ? (
          <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/80 px-2 py-1 font-mono text-xs text-gray-600 shadow">
            {cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
