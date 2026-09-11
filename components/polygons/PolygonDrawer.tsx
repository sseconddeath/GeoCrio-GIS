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

// Своя рисовалка полигона. Прошлая версия рисовала вершины через
// map.addSource + circle-layer, и по неясной причине точки не появлялись,
// хотя state обновлялся. Переписал точки на DOM-маркеры
// (maplibregl.Marker) — это HTML-элементы, которые MapLibre сам
// позиционирует относительно карты. Не зависят от готовности стиля,
// source'ов, слоёв — просто работают. Линию/полигон оставил через
// source+layer: они рисуются один раз в load-хендлере и обновляются
// через setData на уже существующих источниках.
//
// Логика:
//  - клик по карте добавляет точку (оранжевый круг-DOM);
//  - между точками — сплошная линия;
//  - при замыкании — заливка полигона;
//  - кнопки «Отменить точку», «Замкнуть» (с 3+ точками), «Начать заново».
export function PolygonDrawer({ initial, onChange }: PolygonDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // Актуальные closed/onChange для click-хендлера, который вешается
  // один раз (обычный state там был бы навсегда false).
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
      // Двойной клик не зумит — иначе быстрая расстановка сбоила бы.
      doubleClickZoom: false,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    map.on('load', () => {
      if (initial && initial.coordinates[0]?.length >= 4) {
        const coords = initial.coordinates[0] as [number, number][];
        map.fitBounds(polygonBounds(coords), { padding: 40, animate: false });
      }

      // Пустые источники под линию и полигон.
      map.addSource('drawer-poly', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('drawer-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Явно указываем layout.visibility, чтобы MapLibre не пропустил
      // paint при пустом источнике. Без него у нас были случаи, когда
      // layer не появлялся после setData().
      map.addLayer({
        id: 'drawer-poly-fill',
        type: 'fill',
        source: 'drawer-poly',
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': COLORS.header,
          'fill-opacity': 0.2,
          'fill-outline-color': COLORS.header,
        },
      });
      map.addLayer({
        id: 'drawer-poly-line',
        type: 'line',
        source: 'drawer-poly',
        layout: { visibility: 'visible', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.header, 'line-width': 3 },
      });
      map.addLayer({
        id: 'drawer-line-preview',
        type: 'line',
        source: 'drawer-line',
        layout: { visibility: 'visible', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.header,
          'line-width': 3,
          'line-dasharray': [2, 1.5],
        },
      });

      map.on('click', (e) => {
        if (closedRef.current) return;
        setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      });

      map.getCanvas().style.cursor = 'crosshair';

      setMapReady(true);
    });

    return () => {
      // Убираем все DOM-маркеры перед уничтожением карты.
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

  // Пере-рендер маркеров вершин через DOM. Полностью пересоздаём —
  // список маленький, оптимизация не нужна, зато нет рассинхрона
  // «где-то остался старый маркер».
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Снести старые маркеры.
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    // Поставить новые — обычный HTML-круг с рамкой.
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
      // pointerEvents:none — чтобы клик по маркеру не блокировал клик
      // по карте (иначе рядом с существующей точкой нельзя было бы
      // поставить следующую).
      el.style.pointerEvents = 'none';

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coord)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [points, mapReady]);

  // Пере-setData для линии и полигона. Всегда оборачиваем в
  // FeatureCollection — с одиночной Feature у некоторых версий MapLibre
  // paint не триггерился. После setData зовём triggerRepaint(), чтобы
  // WebGL точно перерисовал канвас.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const lineSrc = map.getSource('drawer-line') as maplibregl.GeoJSONSource | undefined;
    const polySrc = map.getSource('drawer-poly') as maplibregl.GeoJSONSource | undefined;
    if (!lineSrc || !polySrc) return;

    const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    if (closed && points.length >= 3) {
      const ring = [...points, points[0]];
      polySrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: {},
          },
        ],
      });
      lineSrc.setData(emptyFC);
      onChangeRef.current({ type: 'Polygon', coordinates: [ring] });
    } else if (points.length >= 2) {
      polySrc.setData(emptyFC);
      lineSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: points },
            properties: {},
          },
        ],
      });
      onChangeRef.current(null);
    } else {
      polySrc.setData(emptyFC);
      lineSrc.setData(emptyFC);
      onChangeRef.current(null);
    }

    // Форсируем redraw — иначе на некоторых билдах MapLibre WebGL
    // канвас перерисовывается только по событиям карты (move/zoom).
    map.triggerRepaint();
  }, [points, closed, mapReady]);

  const canClose = points.length >= 3 && !closed;
  const canUndo = points.length > 0 && !closed;
  const canReset = points.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-md border border-gray-300"
      />
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
