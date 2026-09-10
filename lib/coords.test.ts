import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAccuracy, normalizeCoordInput, parseCoord } from './coords';

test('normalizeCoordInput: запятая → точка', () => {
  assert.equal(normalizeCoordInput('57,20123'), '57.20123');
  assert.equal(normalizeCoordInput('  65.6  '), '65.6');
  assert.equal(normalizeCoordInput('57,20 '), '57.20'); // NBSP
});

test('parseCoord: валидные значения', () => {
  assert.deepEqual(parseCoord('57.2', 'lat'), { value: 57.2, error: null });
  assert.deepEqual(parseCoord('65,6', 'lng'), { value: 65.6, error: null });
  assert.deepEqual(parseCoord('-73.9857', 'lng'), { value: -73.9857, error: null });
});

test('parseCoord: пустая строка = null без ошибки', () => {
  assert.deepEqual(parseCoord('', 'lat'), { value: null, error: null });
  assert.deepEqual(parseCoord('   ', 'lat'), { value: null, error: null });
});

test('parseCoord: не число → ошибка', () => {
  const r = parseCoord('abc', 'lat');
  assert.equal(r.value, null);
  assert.match(r.error!, /Введите число/);
});

test('parseCoord: вне диапазона широты', () => {
  const r = parseCoord('95', 'lat');
  assert.equal(r.value, null);
  assert.match(r.error!, /−90 … 90/);
});

test('parseCoord: вне диапазона долготы', () => {
  const r = parseCoord('200', 'lng');
  assert.equal(r.value, null);
  assert.match(r.error!, /−180 … 180/);
});

test('formatAccuracy: разные диапазоны', () => {
  assert.match(formatAccuracy(5), /хорошо/);
  assert.match(formatAccuracy(20), /нормально/);
  assert.match(formatAccuracy(50), /слабо/);
});
