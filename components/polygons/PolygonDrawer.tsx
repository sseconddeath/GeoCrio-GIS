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

// Своя простая рисовалка полигона (замена terra-draw, у которой была
// не диагностируемая проблема с обработкой кликов на нашем стенде).
//
// Логика:
//  - клик по карте добавляет точку;
//  - точки рисуются как оранжевые кружки на карте;
//  - линии между ними — сплошные;
//  - кнопки «Отменить точку», «Замкнуть» (активна с 3+ точками),
//    «Начать заново»;
//  - при замыкании эмитим готовый GeoJSON.Polygon.
//
// Не даём multi-touch pinch мешать: doubleClickZoom выключен, single
// tap = точка. Долгое нажатие / pan — работают как обычно (MapLibre
// dragPan остаётся включённым).
export function PolygonDrawer({ initial, onChange }: PolygonDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Собственный флаг готовности: isStyleLoaded() возвращает false пока
  // грузятся тайлы OSM, а once('load', ...) после уже отгремевшего load
  // молчит навсегда — из-за этой пары точки копились в state, но не
  // рисовались. Ref флипается в true в load-обработчике сразу после
  // addSource/addLayer, и sync-эффект просто ждёт, пока он не станет true.
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  // Актуальные closed/onChange для click-хендлера — регистрируем on('click')
  // один раз в load-хендлере, поэтому обычные state/props оттуда не видны.
  const closedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Список текущих вершин (long, lat). Пока полигон НЕ замкнут — просто
  // точки; после замыкания — фиксированный полигон. Ставим точки —
  // индикатор снизу подсказывает «нужно ещё 2 точки».
  const [points, setPoints] = useState<[number, number][]>(() => {
    if (initial && initial.coordinates[0]?.length >= 4) {
      // Обратим замкнутое кольцо (первая=последняя) в открытый список.
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
      // Одиночный клик = точка. Двойной клик не зумит.
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

      // Пустые источники — данные потом подтянет второй useEffect.
      map.addSource('drawer-poly', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('drawer-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('drawer-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Заливка (только когда замкнули).
      map.addLayer({
        id: 'drawer-poly-fill',
        type: 'fill',
        source: 'drawer-poly',
        paint: { 'fill-color': COLORS.header, 'fill-opacity': 0.15 },
      });
      // Контур (замкнутый или незамкнутый).
      map.addLayer({
        id: 'drawer-poly-line',
        type: 'line',
        source: 'drawer-poly',
        paint: { 'line-color': COLORS.header, 'line-width': 2 },
      });
      map.addLayer({
        id: 'drawer-line-preview',
        type: 'line',
        source: 'drawer-line',
        paint: {
          'line-color': COLORS.header,
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
      // Точки — крупные и яркие, чтобы даже на пёстрой OSM были видны.
      map.addLayer({
        id: 'drawer-points-circle',
        type: 'circle',
        source: 'drawer-points',
        paint: {
          'circle-radius': 7,
          'circle-color': COLORS.borehole,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Один клик по карте = одна вершина. Игнорируем клик, когда полигон
      // уже замкнут (иначе пользователь начал бы добавлять «висящие»
      // точки к готовому). Если хочет — сначала жмёт «Начать заново».
      // Читаем closed через ref, потому что обработчик регистрируется
      // один раз и state здесь был бы вечно false.
      map.on('click', (e) => {
        if (closedRef.current) return;
        setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      });

      // Курсор pointer над картой — подсказка что клик что-то делает.
      map.getCanvas().style.cursor = 'crosshair';

      // Всё готово — sync-эффект теперь может пушить данные в источники.
      mapReadyRef.current = true;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Реагируем только на смену initial (обычно один раз при монтировании).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Синхронизация closed с ref — читается из click-хендлера.
  useEffect(() => {
    closedRef.current = closed;
  }, [closed]);

  // Синхронизация точек/полигона с MapLibre. Ждём mapReady — иначе
  // источники и слои ещё не созданы. При каждом изменении points/closed
  // пере-setData'им, без пересоздания карты.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const pointsSrc = map.getSource('drawer-points') as maplibregl.GeoJSONSource | undefined;
    const lineSrc = map.getSource('drawer-line') as maplibregl.GeoJSONSource | undefined;
    const polySrc = map.getSource('drawer-poly') as maplibregl.GeoJSONSource | undefined;
    if (!pointsSrc || !lineSrc || !polySrc) return;

    pointsSrc.setData({
      type: 'FeatureCollection',
      features: points.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: p },
        properties: { index: i },
      })),
    });

    if (closed && points.length >= 3) {
      // Замкнутый полигон = заливка + контур; preview-линию гасим.
      polySrc.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
        properties: {},
      });
      lineSrc.setData({ type: 'FeatureCollection', features: [] });
      onChangeRef.current({
        type: 'Polygon',
        coordinates: [[...points, points[0]]],
      });
    } else if (points.length >= 2) {
      // Незамкнутая ломаная — сплошная линия по расставленным точкам.
      polySrc.setData({ type: 'FeatureCollection', features: [] });
      lineSrc.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points },
        properties: {},
      });
      onChangeRef.current(null);
    } else {
      polySrc.setData({ type: 'FeatureCollection', features: [] });
      lineSrc.setData({ type: 'FeatureCollection', features: [] });
      onChangeRef.current(null);
    }
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
