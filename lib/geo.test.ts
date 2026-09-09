import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPointEWKT, pointInPolygon, polygonBounds } from './geo';

// Прямоугольник в районе тестового полигона ТИУ (см. 003_seed_polygon.sql).
const testPolygon: [number, number][] = [
  [65.58, 57.19],
  [65.62, 57.19],
  [65.62, 57.21],
  [65.58, 57.21],
  [65.58, 57.19],
];

test('formatPointEWKT: базовый случай', () => {
  assert.equal(formatPointEWKT(65.6, 57.2), 'SRID=4326;POINT(65.6 57.2)');
});

test('formatPointEWKT: отрицательные координаты', () => {
  assert.equal(formatPointEWKT(-73.9857, 40.7484), 'SRID=4326;POINT(-73.9857 40.7484)');
});

test('formatPointEWKT: отклоняет NaN/Infinity', () => {
  assert.throws(() => formatPointEWKT(Number.NaN, 0), RangeError);
  assert.throws(() => formatPointEWKT(0, Number.POSITIVE_INFINITY), RangeError);
});

test('pointInPolygon: точка в центре', () => {
  assert.equal(pointInPolygon(65.6, 57.2, testPolygon), true);
});

test('pointInPolygon: точка далеко снаружи (Москва)', () => {
  assert.equal(pointInPolygon(37.6, 55.75, testPolygon), false);
});

test('pointInPolygon: чуть за границей', () => {
  assert.equal(pointInPolygon(65.63, 57.2, testPolygon), false);
});

test('pointInPolygon: невалидный полигон (меньше 4 вершин)', () => {
  assert.equal(pointInPolygon(0, 0, [[0, 0], [1, 0], [1, 1]] as [number, number][]), false);
});

test('polygonBounds: правильный bbox', () => {
  const [[west, south], [east, north]] = polygonBounds(testPolygon);
  assert.equal(west, 65.58);
  assert.equal(east, 65.62);
  assert.equal(south, 57.19);
  assert.equal(north, 57.21);
});

test('polygonBounds: пустой полигон бросает', () => {
  assert.throws(() => polygonBounds([]), RangeError);
});
