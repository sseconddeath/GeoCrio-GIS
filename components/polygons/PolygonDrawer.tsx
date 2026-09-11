'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/lib/constants';
import { polygonBounds } from '@/lib/geo';

interface PolygonDrawerProps {
  // Начальное значение — если редактируем существующий полигон.
  initial?: GeoJSON.Polygon | null;
  // Вызывается, когда полигон готов (≥3 точки + пользователь замкнул)
  // или подвинул вершину. null — если полигон ещё не готов.
  onChange: (polygon: GeoJSON.Polygon | null) => void;
}

// OSM-подложка — та же, что в основном MapView.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

// Своя рисовалка полигона. Раньше рисовали через addSource+addLayer —
// в нашем прод-билде MapLibre эти слои не появляются (ни circle, ни
// line, ни fill), причина не диагностирована.
//
// Отказались от MapLibre-слоёв полностью:
//  - вершины — DOM-маркеры (maplibregl.Marker с <div>);
//  - линия/полигон — SVG-оверлей поверх канваса карты, пересчитываем
//    экранные координаты через map.project() на каждом move/zoom и на
//    каждое изменение points/closed.
//
// Работает независимо от WebGL-стилей MapLibre — только базовая карта
// и API проекции lngLat→px.
export function PolygonDrawer({ initial, onChange }: PolygonDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // Актуальные closed/onChange для click-хендлера, который вешается один раз.
  const closedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [points, setPoints] = useState<[number, number][]>(() => {
    if (initial && initial.coordinates[0]?.length >= 4) {
      return initial.coordinates[0].slice(0, -1) as [number, number][];
    }
    return [];
  });
  const [closed, setClosed] = useState<boolean>(
    Boolean(initial && initial.coordinates[0]?.length >= 4),
  );

  // Экранные координаты вершин в пикселях контейнера (для SVG-оверлея).
  // Обновляются в useEffect по [points, mapReady, viewTick]; viewTick
  // тикает на каждый move/zoom карты.
  const [pixels, setPixels] = useState<{ x: number; y: number }[]>([]);
  const [viewTick, setViewTick] = useState(0);
  // Размер контейнера — нужен для viewBox у SVG.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Инициализируем карту один раз.
  useEffect(() => {
    if (!containerRef.current) return;

    let center: [number, number] = [65.6, 57.2];
    let zoom = 4;
    if (initial && initial.coordinates[0]?.length >= 4) {
      const coords = initial.coordinates[0] as [number, number][];
      const [sw, ne] = polygonBounds(coords);
      center = [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2];
      zoom = 12;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
      doubleClickZoom: false,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    const updateSize = () => {
      const c = containerRef.current;
      if (c) setSize({ w: c.clientWidth, h: c.clientHeight });
    };

    map.on('load', () => {
      if (initial && initial.coordinates[0]?.length >= 4) {
        const coords = initial.coordinates[0] as [number, number][];
        map.fitBounds(polygonBounds(coords), { padding: 40, animate: false });
      }

      map.on('click', (e) => {
        if (closedRef.current) return;
        setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      });

      map.getCanvas().style.cursor = 'crosshair';

      updateSize();
      setMapReady(true);
    });

    // На любое движение/зум/ресайз — просто тикаем viewTick, useMemo
    // ниже пересчитает пиксели с актуальной проекцией.
    map.on('move', () => {
      updateSize();
      setViewTick((v) => v + 1);
    });

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    closedRef.current = closed;
  }, [closed]);

  // Пере-рендер DOM-маркеров вершин.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    points.forEach((coord, i) => {
      const el = document.createElement('div');
      el.setAttribute('data-drawer-vertex-index', String(i));
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = COLORS.borehole;
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
      el.style.cursor = 'default';
      el.style.pointerEvents = 'none';

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coord)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [points, mapReady]);

  // Пересчёт пиксельных координат: триггерится добавлением точки,
  // сменой viewTick (move/zoom), готовностью карты. setState в effect
  // тут по существу нужен — pixels зависит от НЕреактивного map.project,
  // без него SVG не пересчитается при движении карты.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!points.length) {
      setPixels([]);
      return;
    }
    setPixels(points.map(([lng, lat]) => map.project([lng, lat])));
  }, [points, mapReady, viewTick]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Оповещаем родителя о готовом полигоне.
  useEffect(() => {
    if (closed && points.length >= 3) {
      const ring = [...points, points[0]];
      onChangeRef.current({ type: 'Polygon', coordinates: [ring] });
    } else {
      onChangeRef.current(null);
    }
  }, [points, closed]);

  const canClose = points.length >= 3 && !closed;
  const canUndo = points.length > 0 && !closed;
  const canReset = points.length > 0;

  // SVG-путь: замкнутый (Z) когда closed, иначе ломаная.
  const pathD = pixels.length
    ? pixels.reduce(
        (acc, p, i) => `${acc}${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)} `,
        '',
      ) + (closed && pixels.length >= 3 ? 'Z' : '')
    : '';

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} className="relative h-[400px] w-full rounded-md border border-gray-300 overflow-hidden">
        {/* SVG-оверлей поверх карты. pointer-events:none — клики уходят
            на карту. Обновляется каждый рендер через pixels. */}
        {mapReady && pixels.length >= 2 ? (
          <svg
            className="pointer-events-none absolute inset-0 z-[5]"
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
          >
            <path
              d={pathD}
              fill={closed && pixels.length >= 3 ? COLORS.header : 'none'}
              fillOpacity={closed && pixels.length >= 3 ? 0.2 : 0}
              stroke={COLORS.header}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={closed ? undefined : '6 4'}
            />
          </svg>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPoints((p) => p.slice(0, -1))}
          disabled={!canUndo}
          className="inline-flex min-h-[36px] items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Отменить точку
        </button>
        <button
          type="button"
          onClick={() => setClosed(true)}
          disabled={!canClose}
          className="inline-flex min-h-[36px] items-center rounded-md bg-header px-3 text-xs font-medium text-white hover:bg-header/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Замкнуть контур
        </button>
        <button
          type="button"
          onClick={() => {
            setPoints([]);
            setClosed(false);
          }}
          disabled={!canReset}
          className="inline-flex min-h-[36px] items-center rounded-md border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Начать заново
        </button>
        <span className="ml-auto text-xs text-gray-600">
          {closed
            ? `Контур замкнут (${points.length} вершин)`
            : points.length === 0
              ? 'Кликните по карте — поставьте первую вершину'
              : points.length < 3
                ? `Ещё ${3 - points.length} точки минимум`
                : `${points.length} точек — можно замыкать`}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Обведите границу участка кликами по карте (минимум 3 точки).
        Точки ставятся в порядке клика, соединяются линиями. Когда всё
        готово — нажмите «Замкнуть контур».
      </p>
    </div>
  );
}
