import { normalizeHeader } from './csv';
import { normalizeCoordInput } from './coords';
import { boreholeSchema, observationPointSchema } from './validation';
import { SOIL_TYPE_LABELS, POINT_TYPE_LABELS } from './constants';

// Отображение импортируемого CSV на строки boreholes/observation_points.
// Заголовки принимаются в двух формах:
//  - русские: код, широта, долгота, глубина, тип грунта, тип точки, описание
//  - английские: code, lat, lng, depth, soil_type, point_type, description
// Индексы колонок вычисляются один раз по заголовку, дальше строки
// маппятся быстро.

export interface CsvImportResult<T> {
  rows: T[];
  errors: Array<{ line: number; message: string }>;
}

const HEADER_MAP: Record<string, string> = {
  // код
  'код': 'code',
  'code': 'code',
  // координаты
  'широта': 'lat',
  'latitude': 'lat',
  'lat': 'lat',
  'долгота': 'lng',
  'longitude': 'lng',
  'lng': 'lng',
  'lon': 'lng',
  // глубина
  'глубина': 'depth_m',
  'глубина м': 'depth_m',
  'depth': 'depth_m',
  'depth m': 'depth_m',
  // тип грунта
  'тип грунта': 'soil_type',
  'грунт': 'soil_type',
  'soil': 'soil_type',
  'soil type': 'soil_type',
  // тип точки
  'тип': 'point_type',
  'тип точки': 'point_type',
  'point type': 'point_type',
  // описание
  'описание': 'description',
  'description': 'description',
  'note': 'description',
  'notes': 'description',
};

const SOIL_LOOKUP = buildLookup(SOIL_TYPE_LABELS);
const POINT_LOOKUP = buildLookup(POINT_TYPE_LABELS);

function buildLookup(labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, label] of Object.entries(labels)) {
    out[key.toLowerCase()] = key;
    out[normalizeHeader(label)] = key;
  }
  return out;
}

function mapHeader(headerRow: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headerRow.forEach((raw, i) => {
    const norm = normalizeHeader(raw);
    const mapped = HEADER_MAP[norm];
    if (mapped && !(mapped in out)) out[mapped] = i;
  });
  return out;
}

export interface BoreholeCsvRow {
  code: string;
  lat: number;
  lng: number;
  depth_m?: number | null;
  soil_type?: string | null;
  description?: string | null;
}

export interface ObservationPointCsvRow {
  code: string;
  lat: number;
  lng: number;
  point_type: string;
  description?: string | null;
}

// Импорт скважин: mapHeader + для каждой строки dry-run через
// boreholeSchema с фиктивным polygonId, чтобы поймать ошибки полей.
// polygonId подставим на сервере — в CSV его нет.
export function mapBoreholesFromCsv(rows: string[][]): CsvImportResult<BoreholeCsvRow> {
  if (rows.length < 2) {
    return { rows: [], errors: [{ line: 0, message: 'Файл пуст или содержит только заголовок' }] };
  }
  const headerIdx = mapHeader(rows[0]);
  const required: Array<keyof BoreholeCsvRow> = ['code', 'lat', 'lng'];
  const missing = required.filter((f) => !(f in headerIdx));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `В заголовке нет обязательных колонок: ${missing.join(', ')}. Ожидается: код, широта, долгота (+ опционально глубина, тип грунта, описание).`,
        },
      ],
    };
  }

  const out: BoreholeCsvRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const codeRaw = pick(row, headerIdx.code);
    if (!codeRaw) continue; // полностью пустая строка — молча пропускаем
    const parsed = boreholeSchema.safeParse({
      polygonId: '00000000-0000-0000-0000-000000000000',
      code: codeRaw,
      lat: normalizeCoordInput(pick(row, headerIdx.lat) ?? ''),
      lng: normalizeCoordInput(pick(row, headerIdx.lng) ?? ''),
      depth_m: normalizeCoordInput(pick(row, headerIdx.depth_m) ?? ''),
      soil_type: lookupSoil(pick(row, headerIdx.soil_type)),
      description: pick(row, headerIdx.description),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ line, message: `${String(first.path[0] ?? '')}: ${first.message}` });
      continue;
    }
    const { code, lat, lng, depth_m, soil_type, description } = parsed.data;
    out.push({ code, lat, lng, depth_m, soil_type, description });
  }
  return { rows: out, errors };
}

export function mapObservationPointsFromCsv(
  rows: string[][],
): CsvImportResult<ObservationPointCsvRow> {
  if (rows.length < 2) {
    return { rows: [], errors: [{ line: 0, message: 'Файл пуст или содержит только заголовок' }] };
  }
  const headerIdx = mapHeader(rows[0]);
  const required: Array<keyof ObservationPointCsvRow> = ['code', 'lat', 'lng', 'point_type'];
  const missing = required.filter((f) => !(f in headerIdx));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `В заголовке нет обязательных колонок: ${missing.join(', ')}. Ожидается: код, широта, долгота, тип точки (+ опционально описание).`,
        },
      ],
    };
  }
  const out: ObservationPointCsvRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const codeRaw = pick(row, headerIdx.code);
    if (!codeRaw) continue;
    const parsed = observationPointSchema.safeParse({
      polygonId: '00000000-0000-0000-0000-000000000000',
      code: codeRaw,
      lat: normalizeCoordInput(pick(row, headerIdx.lat) ?? ''),
      lng: normalizeCoordInput(pick(row, headerIdx.lng) ?? ''),
      point_type: lookupPoint(pick(row, headerIdx.point_type)),
      description: pick(row, headerIdx.description),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ line, message: `${String(first.path[0] ?? '')}: ${first.message}` });
      continue;
    }
    const { code, lat, lng, point_type, description } = parsed.data;
    out.push({ code, lat, lng, point_type, description });
  }
  return { rows: out, errors };
}

function pick(row: string[], idx: number | undefined): string | undefined {
  if (idx === undefined) return undefined;
  const v = row[idx];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

// Пользователь может написать «суглинок» или «loam» — понимаем и
// человекочитаемое, и enum-код. Возвращаем enum-код, или undefined
// если непонятно (zod дальше отклонит с сообщением).
function lookupSoil(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return SOIL_LOOKUP[normalizeHeader(raw)] ?? raw;
}
function lookupPoint(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return POINT_LOOKUP[normalizeHeader(raw)] ?? raw;
}
