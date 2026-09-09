// Чистые геоутилиты, без зависимостей от Next/Supabase — юнит-тестируются
// изолированно (см. lib/geo.test.ts).

// EWKT-строка для колонки geometry(Point, 4326) в PostGIS.
// PostgREST принимает такую строку в insert/update текстовой колонки и
// приводит её к geometry неявно через ST_GeomFromEWKT.
export function formatPointEWKT(lng: number, lat: number): string {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new RangeError('Координаты должны быть конечными числами');
  }
  return `SRID=4326;POINT(${lng} ${lat})`;
}

// Ray-casting: точка внутри полигона? Совпадение с границей считается снаружи —
// это соответствует ожиданиям пользователя (форма всё равно валидируется в
// БД триггером с буфером 500 м, где граница естественно попадает внутрь).
//
// polygon — массив вершин [lng, lat][], первая = последней (замкнут).
export function pointInPolygon(lng: number, lat: number, polygon: readonly [number, number][]): boolean {
  if (polygon.length < 4) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Bounding box полигона — для fitBounds карты. Возвращает [[west, south], [east, north]].
export function polygonBounds(polygon: readonly [number, number][]): [[number, number], [number, number]] {
  if (polygon.length === 0) {
    throw new RangeError('Пустой полигон');
  }
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of polygon) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [
    [west, south],
    [east, north],
  ];
}
