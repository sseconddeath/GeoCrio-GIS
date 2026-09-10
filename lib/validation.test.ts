import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boreholeSchema, measurementSchema, observationPointSchema } from './validation';

const POLYGON = '00000000-0000-0000-0000-000000000001';
const BOREHOLE = '00000000-0000-0000-0000-000000000002';

test('boreholeSchema: валидные данные', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: 'BH-01',
    lng: '65.6',
    lat: '57.2',
    depth_m: '3.5',
    soil_type: 'loam',
    description: 'Тест',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.depth_m, 3.5);
    assert.equal(result.data.soil_type, 'loam');
    assert.equal(result.data.lng, 65.6);
  }
});

test('boreholeSchema: пустые опциональные поля', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: 'BH-02',
    lng: '65.6',
    lat: '57.2',
    depth_m: '',
    soil_type: '',
    description: '',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.depth_m, null);
    assert.equal(result.data.soil_type, null);
    assert.equal(result.data.description, null);
  }
});

test('boreholeSchema: широта вне диапазона', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: 'BH-03',
    lng: '0',
    lat: '95',
  });
  assert.equal(result.success, false);
});

test('boreholeSchema: пустой код', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: '',
    lng: '0',
    lat: '0',
  });
  assert.equal(result.success, false);
});

test('boreholeSchema: глубина больше 500', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: 'BH-04',
    lng: '65',
    lat: '57',
    depth_m: '600',
  });
  assert.equal(result.success, false);
});

test('boreholeSchema: неизвестный soil_type', () => {
  const result = boreholeSchema.safeParse({
    polygonId: POLYGON,
    code: 'BH-05',
    lng: '65',
    lat: '57',
    soil_type: 'lava',
  });
  assert.equal(result.success, false);
});

test('observationPointSchema: валидные данные', () => {
  const result = observationPointSchema.safeParse({
    polygonId: POLYGON,
    code: 'OP-01',
    lng: '65.6',
    lat: '57.2',
    point_type: 'geocryological',
    description: null,
  });
  assert.equal(result.success, true);
});

test('observationPointSchema: обязательный point_type', () => {
  const result = observationPointSchema.safeParse({
    polygonId: POLYGON,
    code: 'OP-02',
    lng: '65.6',
    lat: '57.2',
  });
  assert.equal(result.success, false);
});

// ============================================================================
// Замеры температуры (Этап 4)

test('measurementSchema: валидные данные (строки из FormData)', () => {
  const result = measurementSchema.safeParse({
    boreholeId: BOREHOLE,
    depth_m: '3.5',
    temperature_c: '-1.2',
    measured_at: '2026-03-15T14:30',
    notes: 'Ясно, ветер северный',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.depth_m, 3.5);
    assert.equal(result.data.temperature_c, -1.2);
    assert.equal(result.data.notes, 'Ясно, ветер северный');
  }
});

test('measurementSchema: глубина > 500 → ошибка', () => {
  const result = measurementSchema.safeParse({
    boreholeId: BOREHOLE,
    depth_m: '600',
    temperature_c: '0',
    measured_at: '2026-03-15T14:30',
  });
  assert.equal(result.success, false);
});

test('measurementSchema: температура вне диапазона −50…+50 → ошибка', () => {
  const result = measurementSchema.safeParse({
    boreholeId: BOREHOLE,
    depth_m: '3',
    temperature_c: '-100',
    measured_at: '2026-03-15T14:30',
  });
  assert.equal(result.success, false);
});

test('measurementSchema: дата в далёком будущем → ошибка', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result = measurementSchema.safeParse({
    boreholeId: BOREHOLE,
    depth_m: '3',
    temperature_c: '0',
    measured_at: future,
  });
  assert.equal(result.success, false);
});
