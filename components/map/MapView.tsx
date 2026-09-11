'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

type MapLibreMap = maplibregl.Map;
import { COLORS } from '@/lib/constants';
import { polygonBounds } from '@/lib/geo';
import type { PolygonRow } from '@/lib/supabase/types';

export interface MapObjectProperties {
  id: string;
  name: string;
  type: string;
  polygon_id: string;
  depth_m: number | null;
  soil_type: string | null;
  last_temperature: number | null;
  last_measured_at: string | null;
  permafrost_status: string | null;
  photo_count: number;
}

// OSM tile source в MapLibre-стиле: минимально жизнеспособная подложка без
// внешних API-ключей. Всё остальное (маркеры, попапы, кластеры) добавляется
// императивно после Map init.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export type MapColorMode = 'type' | 'permafrost';

interface MapViewProps {
  polygon: PolygonRow;
  objects: GeoJSON.FeatureCollection<GeoJSON.Point, MapObjectProperties>;
  showPolygonBoundary?: boolean;
  // 'type' — оранжевый для скважин, фиолетовый для точек;
  // 'permafrost' — раскраска по статусу мерзлоты (главный визуальный
  // инсайт: где мёрзлый грунт, где талый, где переход). Для точек
  // наблюдений (permafrost_status = null) — серый.
  colorMode?: MapColorMode;
  onMapClick?: (lng: number, lat: number) => void;
  onFeatureClick?: (feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>) => void;
  onCursorMove?: (lng: number, lat: number) => void;
  // Центр карты меняется при движении — передаём наверх, чтобы FAB
  // «+ Добавить» знал, куда ставить координаты по умолчанию.
  onViewChange?: (lng: number, lat: number) => void;
}

// Цвет DOM-маркера объекта по выбранному режиму раскраски.
function colorForFeature(
  props: MapObjectProperties,
  mode: MapColorMode,
): string {
  if (mode === 'type') {
    return props.type === 'borehole' ? COLORS.borehole : COLORS.observationPoint;
  }
  // permafrost: раскраска по статусу мерзлоты. Для точек наблюдений
  // (permafrost_status = null) — серый.
  switch (props.permafrost_status) {
    case 'frozen':
      return COLORS.permafrost.frozen;
    case 'thawed':
      return COLORS.permafrost.thawed;
    case 'transitional':
      return COLORS.permafrost.transitional;
    default:
      return '#9ca3af';
  }
}

export function MapView({
  polygon,
  objects,
  showPolygonBoundary = true,
  colorMode = 'type',
  onMapClick,
  onFeatureClick,
  onCursorMove,
  onViewChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // DOM-маркеры объектов (скважины/точки) — заводим сами, чтобы обойти
  // не работающие в нашей связке MapLibre circle-слои. Обновляются
  // отдельным useEffect по [objects, colorMode, mapReady].
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // Храним callbacks в ref, чтобы не пересоздавать карту при их изменении.
  const onMapClickRef = useRef(onMapClick);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onCursorMoveRef = useRef(onCursorMove);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onFeatureClickRef.current = onFeatureClick;
    onCursorMoveRef.current = onCursorMove;
    onViewChangeRef.current = onViewChange;
  });

  // Валидная граница полигона в виде GeoJSON.Polygon. Если PostgREST не
  // прислал boundary_geojson (например, миграция 012 ещё не применена
  // на проекте), рисовать нечего — fallback на пустой массив.
  const boundaryCoords: [number, number][] =
    polygon.boundary_geojson &&
    Array.isArray(polygon.boundary_geojson.coordinates?.[0])
      ? (polygon.boundary_geojson.coordinates[0] as [number, number][])
      : [];

  // SVG-оверлей поверх канваса карты для границы полигона: слой fill/line
  // в MapLibre в нашей связке иногда молча не рендерится. SVG работает
  // всегда — проецируем каждую вершину через map.project() и
  // пересчитываем на move/zoom.
  const [boundaryPixels, setBoundaryPixels] = useState<{ x: number; y: number }[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Init/destroy — только один раз за монтирование компонента.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [polygon.center_lng, polygon.center_lat],
      zoom: polygon.default_zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    const updateSize = () => {
      const c = containerRef.current;
      if (c) setSize({ w: c.clientWidth, h: c.clientHeight });
    };
    const recomputeBoundaryPixels = () => {
      updateSize();
      if (!boundaryCoords.length) {
        setBoundaryPixels([]);
        return;
      }
      setBoundaryPixels(boundaryCoords.map(([lng, lat]) => map.project([lng, lat])));
    };

    map.on('load', () => {
      // Bounding box полигона + небольшой padding. Только если граница
      // валидная — иначе оставляем centered на polygon.center_lng/lat.
      if (boundaryCoords.length >= 3) {
        const [sw, ne] = polygonBounds(boundaryCoords);
        map.fitBounds([sw, ne], { padding: 40, animate: false, maxZoom: polygon.default_zoom + 2 });
      } else {
        console.warn(
          '[MapView] polygon.boundary_geojson отсутствует — граница не будет отображена. Убедитесь, что миграция 012 применена.',
          { polygonId: polygon.id, boundary_geojson: polygon.boundary_geojson },
        );
      }

      recomputeBoundaryPixels();
      map.on('move', recomputeBoundaryPixels);

      // Объекты (скважины/точки) больше не рисуются MapLibre-слоями —
      // они молча не отрисовывались в нашей связке (как было и с
      // polygon-boundary). Теперь DOM-маркеры в отдельном useEffect ниже.
      // Кластеризацию временно убрали — у одного полигона обычно < 100
      // объектов, кластеры не нужны.

      type MapClickEv = {
        lngLat: { lng: number; lat: number };
        point: maplibregl.Point;
      };
      type MapMoveEv = { lngLat: { lng: number; lat: number } };

      // Клик по свободному месту карты — эмиттим наверх. Клики по
      // самим DOM-маркерам обрабатываются отдельно на элементах
      // (stopPropagation, чтобы не долетал сюда).
      map.on('click', (e: MapClickEv) => {
        onMapClickRef.current?.(e.lngLat.lng, e.lngLat.lat);
      });

      // Отображение координат курсора наверху.
      map.on('mousemove', (e: MapMoveEv) => {
        onCursorMoveRef.current?.(e.lngLat.lng, e.lngLat.lat);
      });
      setMapReady(true);

      // Центр карты — для FAB «+ Добавить». Эмиттим при загрузке и при
      // каждой остановке движения (moveend).
      const emitCenter = () => {
        const c = map.getCenter();
        onViewChangeRef.current?.(c.lng, c.lat);
      };
      emitCenter();
      map.on('moveend', emitCenter);
    });

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // polygon.id — если сменится, пересобираем карту с нуля.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon.id]);

  // Видимость границы регулируется рендером SVG-оверлея ниже
  // (showPolygonBoundary && boundaryPixels.length >= 3).

  // DOM-маркеры для скважин и точек. Пересоздаём при любом изменении
  // objects или colorMode — список маленький, оптимизация не нужна.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const feature of objects.features) {
      const color = colorForFeature(feature.properties, colorMode);
      const el = document.createElement('div');
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.title = feature.properties.name;
      // stopPropagation — иначе клик долетит до карты и сработает
      // onMapClick, закрывающий/меняющий состояние.
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onFeatureClickRef.current?.(feature);
      });

      const coords = feature.geometry.coordinates as [number, number];
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [objects, colorMode, mapReady]);

  // Path для SVG-оверлея границы полигона: M x,y L x,y ... Z.
  const boundaryPath = boundaryPixels.length
    ? boundaryPixels.reduce(
        (acc, p, i) => `${acc}${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)} `,
        '',
      ) + 'Z'
    : '';

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {showPolygonBoundary && boundaryPixels.length >= 3 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[5]"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          <path
            d={boundaryPath}
            fill={COLORS.header}
            fillOpacity={0.06}
            stroke={COLORS.header}
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
