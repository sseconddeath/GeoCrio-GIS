import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader, parseCsv } from './csv';

test('parseCsv: простой CSV с запятыми', () => {
  const r = parseCsv('a,b,c\n1,2,3\n4,5,6');
  assert.deepEqual(r, [
    ['a', 'b', 'c'],
    ['1', '2', '3'],
    ['4', '5', '6'],
  ]);
});

test('parseCsv: CSV с ; (Excel-ru)', () => {
  const r = parseCsv('код;широта;долгота\nСкв-01;57.2;65.6\nСкв-02;57.3;65.7');
  assert.deepEqual(r, [
    ['код', 'широта', 'долгота'],
    ['Скв-01', '57.2', '65.6'],
    ['Скв-02', '57.3', '65.7'],
  ]);
});

test('parseCsv: кавычки и escape ""', () => {
  const r = parseCsv('a,b\n"hello, world","she said ""ok"""');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['hello, world', 'she said "ok"'],
  ]);
});

test('parseCsv: перенос строки внутри кавычек', () => {
  const r = parseCsv('a,b\n"multi\nline","x"');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['multi\nline', 'x'],
  ]);
});

test('parseCsv: BOM в начале', () => {
  const r = parseCsv('﻿a,b\n1,2');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('parseCsv: CRLF переносы', () => {
  const r = parseCsv('a,b\r\n1,2\r\n3,4');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('parseCsv: пустые строки в конце игнорируются', () => {
  const r = parseCsv('a,b\n1,2\n\n\n');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('parseCsv: пустая строка', () => {
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('   \n  '), []);
});

test('normalizeHeader: ё→е, пробелы, регистр', () => {
  assert.equal(normalizeHeader('Тёмный ТИП грунта'), 'темный тип грунта');
  assert.equal(normalizeHeader('  ШИРОТА  '), 'широта');
  assert.equal(normalizeHeader('depth_m'), 'depth m');
});
