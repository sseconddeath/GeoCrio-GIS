import { z } from 'zod';

// Импорт-побочный эффект: устанавливает русскоязычный errorMap на
// глобальный zod для случаев, когда мы не передали свой message
// (например, z.enum([...]) без опций — раньше давал английское
// «Invalid enum value...»).
import './zod-ru';

// Минимальная длина пароля здесь (8) может быть строже, чем настройка
// Supabase Auth в конкретном проекте (по умолчанию 6). Сверить с Dashboard →
// Authentication → Policies при первом деплое — если сервер разрешает
// более короткие пароли, это безобидно (клиент просто строже), но если
// потребуется единообразие, поднять/опустить здесь.
const PASSWORD_MIN_LENGTH = 8;

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Введите имя и фамилию'),
    email: z.string().email('Введите корректный email'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================================================
// Этап 2: CRUD скважин и точек наблюдений
// ============================================================================

// FormData → строка → число: пустая строка становится null, невалидное — undefined.
const optionalNumber = z
  .union([z.string().length(0), z.string(), z.number()])
  .transform((value) => {
    if (value === '' || value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  })
  .nullable();

const requiredNumber = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine((n) => Number.isFinite(n), 'Введите число');

const lat = requiredNumber.refine(
  (n) => n >= -90 && n <= 90,
  'Широта должна быть в диапазоне −90 … 90',
);
const lng = requiredNumber.refine(
  (n) => n >= -180 && n <= 180,
  'Долгота должна быть в диапазоне −180 … 180',
);

const code = z
  .string()
  .trim()
  .min(1, 'Введите код объекта')
  .max(64, 'Код не длиннее 64 символов');

const description = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? null : v));

const depth = optionalNumber.refine(
  (n) => n === null || (n > 0 && n <= 500),
  'Глубина должна быть в пределах 0…500 м',
);

const soilType = z
  .union([
    z.enum(['clay', 'loam', 'sand', 'gravel', 'peat', 'rock', 'other']),
    z.literal(''),
    z.null(),
  ])
  .transform((v) => (v === '' || v == null ? null : v));

const pointType = z.enum(
  ['geological', 'hydrological', 'geomorphological', 'geocryological', 'vegetation', 'other'],
  { message: 'Выберите тип точки наблюдения' },
);

export const boreholeSchema = z.object({
  polygonId: z.string().uuid('Некорректный идентификатор полигона'),
  code,
  lng,
  lat,
  depth_m: depth,
  soil_type: soilType,
  description,
});

export const observationPointSchema = z.object({
  polygonId: z.string().uuid('Некорректный идентификатор полигона'),
  code,
  lng,
  lat,
  point_type: pointType,
  description,
});

export type BoreholeInput = z.infer<typeof boreholeSchema>;
export type ObservationPointInput = z.infer<typeof observationPointSchema>;

// ============================================================================
// Этап 2.5: полигоны (участки) + приглашения соавторов
// ============================================================================

const polygonName = z
  .string()
  .trim()
  .min(2, 'Название участка — минимум 2 символа')
  .max(120, 'Название не длиннее 120 символов');

// Клиент передаёт границу как GeoJSON.Polygon (объект, а не строка).
// Server Action переведёт её в EWKT перед вставкой в БД.
const polygonBoundary = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z
      .array(z.array(z.tuple([z.number(), z.number()])))
      .min(1, 'Полигон должен содержать хотя бы одно кольцо'),
  })
  .refine(
    (poly) => poly.coordinates[0].length >= 4,
    'Полигон должен содержать не менее 3 разных вершин (первая = последней)',
  );

const isPublic = z
  .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.undefined()])
  .transform((v) => v === true || v === 'on' || v === 'true');

export const polygonSchema = z.object({
  name: polygonName,
  description: description,
  boundary: polygonBoundary,
  is_public: isPublic,
});

export const polygonInviteSchema = z.object({
  polygonId: z.string().uuid('Некорректный идентификатор участка'),
  email: z.string().email('Введите корректный email коллеги'),
});

export type PolygonInput = z.infer<typeof polygonSchema>;
export type PolygonInviteInput = z.infer<typeof polygonInviteSchema>;

// ============================================================================
// Этап 4: замеры температуры
// ============================================================================

// Диапазоны копируем из CHECK-констрейнтов measurements
// (см. supabase/migrations/001_initial_schema.sql):
//   depth_m       0.01…500 м
//   temperature_c −50…+50 °C
//   measured_at   не в будущем (запас в час на рассинхрон часов клиента).
const measurementDepth = requiredNumber.refine(
  (n) => n > 0 && n <= 500,
  'Глубина должна быть в пределах 0…500 м',
);

const measurementTemperature = requiredNumber.refine(
  (n) => n >= -50 && n <= 50,
  'Температура должна быть в пределах −50…+50 °C',
);

// Принимаем datetime-local строку (напр. "2026-03-15T14:30") — из
// <input type="datetime-local"> формы, или полноценный ISO с
// таймзоной из тестов.
const measurementDate = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === 'string' ? v : v.toISOString()))
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Введите корректную дату/время замера')
  .refine(
    (v) => Date.parse(v) <= Date.now() + 60 * 60 * 1000,
    'Дата замера не может быть в будущем',
  );

const measurementNotes = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? null : v));

export const measurementSchema = z.object({
  boreholeId: z.string().uuid('Некорректный идентификатор скважины'),
  depth_m: measurementDepth,
  temperature_c: measurementTemperature,
  measured_at: measurementDate,
  notes: measurementNotes,
});

export type MeasurementInput = z.infer<typeof measurementSchema>;

// ============================================================================
// Этап 5.3: предложения правок
// ============================================================================

// Whitelist полей, которые можно менять через предложение. Совпадает с
// логикой fn_apply_edit_proposal в миграции 006 (там же — почему НЕ
// разрешены координаты).
const BOREHOLE_PROPOSAL_FIELDS = ['code', 'depth_m', 'soil_type', 'description'] as const;
const OBSERVATION_POINT_PROPOSAL_FIELDS = ['code', 'point_type', 'description'] as const;

const proposalReason = z
  .string()
  .trim()
  .min(5, 'Опишите причину правки хотя бы в 5 символах')
  .max(500, 'Слишком длинное пояснение — до 500 символов');

const proposalStringField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? undefined : String(v).trim()))
  .transform((v) => (v === '' ? '' : v));

export const editProposalSchema = z
  .object({
    targetTable: z.enum(['boreholes', 'observation_points']),
    targetId: z.string().uuid('Некорректный идентификатор объекта'),
    polygonId: z.string().uuid('Некорректный идентификатор участка'),
    reason: proposalReason,
    // Все whitelisted поля — необязательные строки. На сервере
    // отфильтруем пустые (пользователь не хочет менять) и передадим в
    // proposed_data то, что осталось. Формат — flat JSON, потому что
    // fn_apply_edit_proposal читает JSONB по ключам.
    code: proposalStringField.optional(),
    depth_m: proposalStringField.optional(),
    soil_type: proposalStringField.optional(),
    point_type: proposalStringField.optional(),
    description: proposalStringField.optional(),
  })
  .refine(
    (v) => {
      // Хотя бы одно поле должно быть заполнено.
      const fields =
        v.targetTable === 'boreholes'
          ? BOREHOLE_PROPOSAL_FIELDS
          : OBSERVATION_POINT_PROPOSAL_FIELDS;
      return fields.some((f) => {
        const value = (v as Record<string, string | undefined>)[f];
        return value !== undefined && value !== '';
      });
    },
    { message: 'Заполните хотя бы одно поле, которое хотите изменить' },
  );

export type EditProposalInput = z.infer<typeof editProposalSchema>;

// Извлекает only-whitelist поля из валидированного input в JSONB для
// колонки proposed_data. Пустые строки означают «очистить поле»
// (см. fn_apply_edit_proposal: NULLIF(..., '')).
export function proposalDataFromInput(
  input: EditProposalInput,
): Record<string, string> {
  const fields =
    input.targetTable === 'boreholes'
      ? BOREHOLE_PROPOSAL_FIELDS
      : OBSERVATION_POINT_PROPOSAL_FIELDS;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const value = (input as Record<string, string | undefined>)[f];
    if (value !== undefined) out[f] = value;
  }
  return out;
}
