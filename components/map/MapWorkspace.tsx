'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PolygonRow, PolygonStatsRow } from '@/lib/supabase/types';
import { AddObjectPanel } from './AddObjectPanel';
import { LayerPanel, type LayerVisibility, type MapColorMode } from './LayerPanel';
import { MapView, type MapObjectProperties } from './MapView';
import { Popup } from './Popup';
import { RealtimeRefresh } from './RealtimeRefresh';
import { SearchBox } from './SearchBox';

interface MapWorkspaceProps {
  polygon: PolygonRow;
  objects: GeoJSON.FeatureCollection<GeoJSON.Point, MapObjectProperties>;
  stats: PolygonStatsRow | null;
  // Может ли текущий пользователь править объекты этого полигона? (Автор,
  // соавтор или админ.) Если нет — FAB «+ Добавить» скрыт, попап
  // показывает только «Профиль» без «Редактировать».
  canWrite: boolean;
}

export function MapWorkspace({ polygon, objects, stats, canWrite }: MapWorkspaceProps) {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    boreholes: true,
    observationPoints: true,
    polygonBoundary: true,
  });
  const [colorMode, setColorMode] = useState<MapColorMode>('type');
  const [selectedFeature, setSelectedFeature] = useState<
    GeoJSON.Feature<GeoJSON.Point, MapObjectProperties> | null
  >(null);
  const [addAt, setAddAt] = useState<{ lng: number; lat: number } | null>(null);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const [viewCenter, setViewCenter] = useState<{ lng: number; lat: number }>({
    lng: polygon.center_lng,
    lat: polygon.center_lat,
  });
  const [showSidebar, setShowSidebar] = useState(false);

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

  // Клик по свободному месту карты — только для попапа над маркерами
  // (проблема A4 в аудите: случайный тап на мобиле не должен открывать
  // форму добавления). НО если панель добавления уже открыта — клик
  // по карте обновляет координаты, чтобы поставить точку прямо на
  // нужное место (запрос пользователя).
  const handleFeatureClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>) => {
      setAddAt(null);
      setSelectedFeature(feature);
      setShowSidebar(false);
    },
    [],
  );

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      // Только когда панель добавления уже открыта — иначе игнорируем.
      setAddAt((prev) => (prev ? { lng, lat } : prev));
    },
    [],
  );

  const openAddPanel = () => {
    setSelectedFeature(null);
    setAddAt(viewCenter);
    setShowSidebar(false);
  };

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] w-full">
      <RealtimeRefresh polygonId={polygon.id} />
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
          colorMode={colorMode}
          onToggle={(key) => setVisibility((v) => ({ ...v, [key]: !v[key] }))}
          onChangeColorMode={setColorMode}
        />
      </aside>

      {/* Кнопка "Слои" — только на планшете/мобилке. */}
      <button
        type="button"
        onClick={() => setShowSidebar((v) => !v)}
        className="absolute bottom-24 left-4 z-10 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium shadow-md lg:hidden"
      >
        {showSidebar ? 'Скрыть слои' : 'Слои'}
      </button>

      <div className="relative flex-1">
        <MapView
          polygon={polygon}
          objects={filteredObjects}
          showPolygonBoundary={visibility.polygonBoundary}
          colorMode={colorMode}
          previewLng={addAt?.lng ?? null}
          previewLat={addAt?.lat ?? null}
          onFeatureClick={handleFeatureClick}
          onMapClick={handleMapClick}
          onCursorMove={(lng, lat) => setCursor({ lng, lat })}
          onViewChange={(lng, lat) => setViewCenter({ lng, lat })}
        />

        <SearchBox
          features={filteredObjects.features}
          onSelect={handleFeatureClick}
        />

        {/* FAB «+ Добавить» — только для команды участка. Позиция:
            правый нижний угол, над MobileNav (bottom-24 = 6rem, чтобы не
            перекрываться нижней навигацией мобилы). */}
        {canWrite && !addAt ? (
          <button
            type="button"
            onClick={openAddPanel}
            className="absolute bottom-24 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-header text-2xl font-light text-white shadow-lg hover:bg-header/90 md:bottom-6"
            aria-label="Добавить объект"
            title="Добавить скважину или точку наблюдения"
          >
            +
          </button>
        ) : null}

        {selectedFeature ? (
          <Popup
            feature={selectedFeature}
            canEdit={canWrite}
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

        {addAt && canWrite ? (
          <AddObjectPanel
            polygonId={polygon.id}
            lng={addAt.lng}
            lat={addAt.lat}
            onClose={() => setAddAt(null)}
          />
        ) : null}

        {!canWrite ? (
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-gray-200 bg-white/95 px-4 py-1 text-xs text-gray-600 shadow-md">
            Просмотр — редактирование доступно только команде участка
          </div>
        ) : null}

        {/* Координаты курсора — только на десктопе (у мобилки нет мыши). */}
        {cursor ? (
          <div className="pointer-events-none absolute bottom-2 right-2 hidden rounded bg-white/80 px-2 py-1 font-mono text-xs text-gray-600 shadow md:block">
            {cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
