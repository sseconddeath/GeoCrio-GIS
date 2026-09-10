import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMapObjectsGeoJSON,
  getPolygon,
  listBoreholes,
  listObservationPoints,
} from '@/lib/supabase/queries';
import { POINT_TYPE_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';

// GET /api/export?polygon=<id>&format=geojson|csv
// Экспорт всех объектов одного участка. RLS фильтрует автоматически —
// доступ выдаст только те объекты, что видны текущему пользователю.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const polygonId = request.nextUrl.searchParams.get('polygon');
  const format = request.nextUrl.searchParams.get('format') ?? 'geojson';
  if (!polygonId) return new NextResponse('Missing polygon parameter', { status: 400 });

  const polygon = await getPolygon(polygonId);
  if (!polygon) return new NextResponse('Not found', { status: 404 });

  const safeName = polygon.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 80) || 'polygon';

  if (format === 'geojson') {
    const collection = await getMapObjectsGeoJSON(polygonId);
    return new NextResponse(JSON.stringify(collection, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.geojson"`,
      },
    });
  }

  if (format === 'csv') {
    const [boreholes, points] = await Promise.all([
      listBoreholes(polygonId),
      listObservationPoints(polygonId),
    ]);
    const rows: string[] = [
      ['код', 'тип', 'параметры', 'описание', 'дата_создания'].join(';'),
    ];
    for (const b of boreholes) {
      const params = [
        b.soil_type ? SOIL_TYPE_LABELS[b.soil_type] : null,
        b.depth_m != null ? `${b.depth_m} м` : null,
      ]
        .filter(Boolean)
        .join(', ');
      rows.push(csv([b.code, 'скважина', params, b.description ?? '', b.created_at]));
    }
    for (const p of points) {
      rows.push(
        csv([
          p.code,
          POINT_TYPE_LABELS[p.point_type] ?? 'точка',
          '',
          p.description ?? '',
          p.created_at,
        ]),
      );
    }
    // BOM для Excel — иначе кириллица открывается как крокозябры.
    const body = '﻿' + rows.join('\n');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.csv"`,
      },
    });
  }

  return new NextResponse('Unknown format', { status: 400 });
}

function csv(values: string[]): string {
  return values
    .map((v) => {
      const s = String(v ?? '');
      if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(';');
}
