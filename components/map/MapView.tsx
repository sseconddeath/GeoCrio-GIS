'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

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

// MapLibre paint-выражение для одиночных маркеров, по режиму раскраски.
function circleColorExpr(mode: MapColorMode): maplibregl.DataDrivenPropertyValueSpecification<string> {
  if (mode === 'type') {
    return [
      'case',
      ['==', ['get', 'type'], 'borehole'],
      COLORS.borehole,
      COLORS.observationPoint,
    ];
  }
  // permafrost: match по свойству permafrost_status из map_objects view.
  return [
    'match',
    ['coalesce', ['get', 'permafrost_status'], 'unknown'],
    'frozen',
    COLORS.permafrost.frozen,
    'thawed',
    COLORS.permafrost.thawed,
    'transitional',
    COLORS.permafrost.transitional,
    /* default */ '#9ca3af',
  ];
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

    map.on('load', () => {
      // Штриховая граница полигона (раздел 7.1 ТЗ).
      map.addSource('polygon-boundary', {
        type: 'geojson',
        data: { type: 'Feature', geometry: polygon.boundary_geojson, properties: {} },
      });
      map.addLayer({
        id: 'polygon-boundary-fill',
        type: 'fill',
        source: 'polygon-boundary',
        paint: { 'fill-color': COLORS.header, 'fill-opacity': 0.03 },
      });
      map.addLayer({
        id: 'polygon-boundary-line',
        type: 'line',
        source: 'polygon-boundary',
        paint: {
          'line-color': COLORS.header,
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });

      // Bounding box полигона + небольшой padding.
      const coords = polygon.boundary_geojson.coordinates[0] as [number, number][];
      const [sw, ne] = polygonBounds(coords);
      map.fitBounds([sw, ne], { padding: 40, animate: false, maxZoom: polygon.default_zoom + 2 });

      // Кластеризованный source для всех объектов карты.
      map.addSource('objects', {
        type: 'geojson',
        data: objects,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
      });

      // Кластеры (круги с числом).
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'objects',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': COLORS.header,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'objects',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Отдельные объекты (не кластер). Цвет — по выбранному режиму
      // (тип объекта или статус мерзлоты); paint пересобирается при
      // смене режима отдельным useEffect ниже.
      map.addLayer({
        id: 'objects-unclustered',
        type: 'circle',
        source: 'objects',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': circleColorExpr(colorMode),
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Смена курсора над кликабельными слоями.
      const setPointerOn = (layerId: string) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      };
      setPointerOn('clusters');
      setPointerOn('objects-unclustered');

      // Локальные структурные типы: MapLibre-события MapLayerMouseEvent
      // объявлены в самом пакете как локальные `type` без export,
      // поэтому импортировать их напрямую нельзя. Дублируем ровно то, что
      // используем — это узкий контракт, а не полный MapLibre-tip.
      type LayerClickEv = {
        features?: Array<{
          properties?: Record<string, unknown> | null;
          geometry: GeoJSON.Geometry;
        }>;
      };
      type MapClickEv = {
        lngLat: { lng: number; lat: number };
        point: maplibregl.Point;
      };
      type MapMoveEv = { lngLat: { lng: number; lat: number } };

      // Клик по кластеру — приблизить.
      map.on('click', 'clusters', (e: LayerClickEv) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        const source = map.getSource('objects') as maplibregl.GeoJSONSource;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom: number) => {
            if (feature.geometry.type === 'Point') {
              map.easeTo({
                center: feature.geometry.coordinates as [number, number],
                zoom,
              });
            }
          })
          .catch(() => {
            // no-op
          });
      });

      // Клик по одиночному маркеру — попап через callback (React рендерит его сам).
      map.on('click', 'objects-unclustered', (e: LayerClickEv) => {
        const feature = e.features?.[0];
        if (!feature) return;
        onFeatureClickRef.current?.(
          feature as unknown as GeoJSON.Feature<GeoJSON.Point, MapObjectProperties>,
        );
      });

      // Общий клик по карте (не по объекту/кластеру) — эмиттим наверх.
      map.on('click', (e: MapClickEv) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['clusters', 'objects-unclustered'],
        });
        if (hits.length === 0) {
          onMapClickRef.current?.(e.lngLat.lng, e.lngLat.lat);
        }
      });

      // Отображение координат курсора наверху.
      map.on('mousemove', (e: MapMoveEv) => {
        onCursorMoveRef.current?.(e.lngLat.lng, e.lngLat.lat);
      });

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
      map.remove();
      mapRef.current = null;
    };
    // polygon.id — если сменится, пересобираем карту с нуля.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon.id]);

  // Обновление данных источника при изменении objects — без пересоздания карты.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource('objects') as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(objects);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [objects]);

  // Переключение видимости границы полигона.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const value: 'visible' | 'none' = showPolygonBoundary ? 'visible' : 'none';
      for (const id of ['polygon-boundary-fill', 'polygon-boundary-line']) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [showPolygonBoundary]);

  // Смена цвета маркеров при переключении режима — без пересоздания карты.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer('objects-unclustered')) {
        map.setPaintProperty('objects-unclustered', 'circle-color', circleColorExpr(colorMode));
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [colorMode]);

  return <div ref={containerRef} className="h-full w-full" />;
}
