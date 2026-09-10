import { z } from 'zod';

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
