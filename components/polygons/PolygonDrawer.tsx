'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { COLORS } from '@/lib/constants';
import { polygonBounds } from '@/lib/geo';

interface PolygonDrawerProps {
  // Начальное значение — если редактируем существующий полигон.
  initial?: GeoJSON.Polygon | null;
  // Вызывается, когда пользователь закончил рисовать (2й клик по первой
  // вершине замыкает полигон) или подвинул вершину. null — если полигон
  // ещё не готов (0-2 вершины).
  onChange: (polygon: GeoJSON.Polygon | null) => void;
}

// OSM-подложка — та же, что в основном MapView, чтобы редактор границы
// выглядел единообразно с основной картой.
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

// Императивная обёртка: MapLibre в useEffect, поверх — TerraDraw.
// Компонент не связан с React-стейтом на каждый клик — только эмиттит
// готовый полигон в onChange.
export function PolygonDrawer({ initial, onChange }: PolygonDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Стартовый вид: если есть initial — фитим по нему; иначе — мир целиком.
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
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    let draw: TerraDraw | null = null;

    map.on('load', () => {
      // Если есть initial — фитим сразу.
      if (initial && initial.coordinates[0]?.length >= 4) {
        const coords = initial.coordinates[0] as [number, number][];
        map.fitBounds(polygonBounds(coords), { padding: 40, animate: false });
      }

      const adapter = new TerraDrawMapLibreGLAdapter({ map });
      draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: COLORS.header,
              fillOpacity: 0.1,
              outlineColor: COLORS.header,
              outlineWidth: 2,
              closingPointWidth: 6,
              closingPointColor: COLORS.borehole,
            },
          }),
        ],
      });
      draw.start();
      draw.setMode('polygon');

      if (initial && initial.coordinates[0]?.length >= 4) {
        // addFeatures требует id + createdAt/updatedAt по спецификации,
        // но при отсутствии id генератор их сам добавит.
        draw.addFeatures([
          {
            type: 'Feature',
            geometry: initial,
            properties: { mode: 'polygon' },
          },
        ]);
      }

      // Эмиттим полигон при каждом изменении.
      const emit = () => {
        if (!draw) return;
        const features = draw.getSnapshot();
        const polygonFeature = features.find((f) => f.geometry.type === 'Polygon');
        if (polygonFeature && polygonFeature.geometry.type === 'Polygon') {
          onChangeRef.current(polygonFeature.geometry as GeoJSON.Polygon);
        } else {
          onChangeRef.current(null);
        }
      };
      draw.on('finish', emit);
      draw.on('change', emit);
    });

    return () => {
      try {
        draw?.stop();
      } catch {
        // no-op — если draw уже остановлен
      }
      map.remove();
    };
    // Перерисовка ТОЛЬКО при смене initial (обычно один раз при монтировании
    // на страницах создания/редактирования).
  }, [initial]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-md border border-gray-300"
      />
      <p className="text-xs text-gray-500">
        Кликните на карту, чтобы поставить вершины границы участка. Чтобы
        замкнуть контур, кликните на первую вершину ещё раз. Существующие
        вершины можно двигать (кликнув и потянув).
      </p>
    </div>
  );
}
