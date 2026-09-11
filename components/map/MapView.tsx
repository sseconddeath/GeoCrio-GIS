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
  // Превью-точка для click-to-place: пока панель добавления открыта,
  // ставим анимированный маркер, чтобы юзер видел, куда попадёт.
  previewLng?: number | null;
  previewLat?: number | null;
  onMapClick?: (lng: number, lat: number) => void;
  onFeatureClick?: (feature: GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>) => void;
  // onCursorMove: удалён — координаты курсора теперь обновляются
  // прямым DOM-текстом внутри MapView, без прокидывания наверх.
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
  previewLng,
  previewLat,
  onMapClick,
  onFeatureClick,
  onViewChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // DOM-маркеры объектов (скважины/точки) — заводим сами, чтобы обойти
  // не работающие в нашей связке MapLibre circle-слои. Обновляются
  // отдельным useEffect по [objects, colorMode, mapReady].
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // Одиночный маркер-превью для click-to-place.
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  // SVG-оверлей границы полигона и его path — обновляем прямо через
  // DOM-ref, чтобы НЕ гнать через React reconciliation на каждом move.
  // Раньше был setState → каскад re-render'ов → лаги при близком зуме.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Текст координат курсора — тоже прямой DOM-update, чтобы mousemove
  // (десятки раз в секунду) не тянул перерисовку интерфейса.
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Храним callbacks в ref, чтобы не пересоздавать карту при их изменении.
  const onMapClickRef = useRef(onMapClick);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onFeatureClickRef.current = onFeatureClick;
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
  const boundaryCoordsRef = useRef<[number, number][]>(boundaryCoords);
  useEffect(() => {
    boundaryCoordsRef.current = boundaryCoords;
  });

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

    // Throttle через rAF — MapLibre фаерит move до 60 раз/сек. Обновляем
    // SVG-путь ПРЯМО через DOM-ref, без setState/React reconcile.
    let rafId: number | null = null;
    const redrawBoundary = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const svg = svgRef.current;
        const path = pathRef.current;
        const container = containerRef.current;
        if (!svg || !path || !container) return;

        const w = container.clientWidth;
        const h = container.clientHeight;
        // Актуальный размер SVG — если контейнер отресайзился.
        if (svg.getAttribute('width') !== String(w)) svg.setAttribute('width', String(w));
        if (svg.getAttribute('height') !== String(h)) svg.setAttribute('height', String(h));

        const coords = boundaryCoordsRef.current;
        if (coords.length < 3) {
          path.setAttribute('d', '');
          return;
        }

        // Собираем path строкой без React. При очень близком зуме
        // вершины уезжают на миллионы пикселей, но SVG сам это стерпит.
        let d = '';
        for (let i = 0; i < coords.length; i++) {
          const p = map.project(coords[i] as [number, number]);
          d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
        }
        d += 'Z';
        path.setAttribute('d', d);
      });
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

      redrawBoundary();
      map.on('move', redrawBoundary);
      // Ресайз окна тоже должен пересчитать SVG.
      const ro = new ResizeObserver(redrawBoundary);
      if (containerRef.current) ro.observe(containerRef.current);
      resizeObserverRef.current = ro;

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

      // Координаты курсора: обновляем прямо в textContent через ref,
      // без setState (иначе mousemove тянул бы re-render всего
      // MapWorkspace на каждый пиксель).
      map.on('mousemove', (e: MapMoveEv) => {
        if (cursorRef.current) {
          cursorRef.current.textContent = `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`;
        }
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
      if (rafId != null) cancelAnimationFrame(rafId);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // polygon.id — если сменится, пересобираем карту с нуля.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon.id]);

  // Видимость границы — прямым style.display, чтобы не пересобирать
  // SVG при переключении чекбокса «Граница полигона» в LayerPanel.
  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.display = showPolygonBoundary ? 'block' : 'none';
    }
  }, [showPolygonBoundary]);

  // Превью-маркер для click-to-place: пульсирующий круг на месте,
  // куда встанет создаваемая скважина/точка. Двигается при клике по карте.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (previewLng == null || previewLat == null) {
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      return;
    }

    if (!previewMarkerRef.current) {
      // MapLibre выставляет transform: translate(...) на самом элементе
      // маркера. Если сюда же поставить animation с transform: scale(),
      // MapLibre-перевод стирается и маркер оказывается в (0,0) — юзер
      // его не видит. Разделяем: внешний div MapLibre двигает, внутренний
      // pulse-div свободно крутит свою scale-анимацию.
      const outer = document.createElement('div');
      outer.style.width = '22px';
      outer.style.height = '22px';
      outer.style.pointerEvents = 'none';

      const pulse = document.createElement('div');
      pulse.style.width = '100%';
      pulse.style.height = '100%';
      pulse.style.borderRadius = '50%';
      pulse.style.backgroundColor = COLORS.borehole;
      pulse.style.border = '3px solid #ffffff';
      pulse.style.boxShadow = `0 0 0 3px ${COLORS.borehole}66, 0 2px 6px rgba(0,0,0,0.4)`;
      pulse.style.animation = 'mv-pulse 1.4s ease-in-out infinite';
      pulse.style.transformOrigin = 'center';
      outer.appendChild(pulse);

      previewMarkerRef.current = new maplibregl.Marker({
        element: outer,
        anchor: 'center',
      })
        .setLngLat([previewLng, previewLat])
        .addTo(map);
    } else {
      previewMarkerRef.current.setLngLat([previewLng, previewLat]);
    }
  }, [previewLng, previewLat, mapReady]);

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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* SVG рисуется один раз при монтировании; path обновляется через
          ref в rAF-цикле — React в hot path не участвует. Видимость
          управляется прямым style.display через отдельный useEffect. */}
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 z-[5]"
        aria-hidden
        style={{ display: showPolygonBoundary ? 'block' : 'none' }}
      >
        <path
          ref={pathRef}
          d=""
          fill={COLORS.header}
          fillOpacity={0.06}
          stroke={COLORS.header}
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      </svg>
      {/* Координаты курсора — только на десктопе. Обновляются через
          cursorRef.textContent в mousemove-хендлере, без React. */}
      <div
        ref={cursorRef}
        className="pointer-events-none absolute bottom-2 right-2 hidden rounded bg-white/80 px-2 py-1 font-mono text-xs text-gray-600 shadow md:block"
      />
    </div>
  );
}
