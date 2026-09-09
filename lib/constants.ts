// Единый источник констант UI. tailwind.config.ts импортирует COLORS отсюда,
// а Этап 2 (MapLibre) будет использовать те же hex-значения напрямую в
// paint-выражениях — карта не умеет читать Tailwind-классы. Один источник
// исключает расхождение палитры между картой и остальным интерфейсом.

export const COLORS = {
  header: '#1a1f2e',
  borehole: '#D85A30',
  observationPoint: '#534AB7',
  water: '#378ADD',
  permafrost: {
    frozen: '#E24B4A',
    thawed: '#EF9F27',
    transitional: '#378ADD',
  },
} as const;

export type UserRole = 'admin' | 'researcher' | 'student';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  researcher: 'Исследователь',
  student: 'Студент',
};

// Русские метки для enum'ов, приходящих из БД. Значения обязаны совпадать с
// CHECK-констрейнтами в миграции 001, метки — для UI.
export const SOIL_TYPE_LABELS = {
  clay: 'Глина',
  loam: 'Суглинок',
  sand: 'Песок',
  gravel: 'Гравий',
  peat: 'Торф',
  rock: 'Скальный грунт',
  other: 'Другое',
} as const;

export const POINT_TYPE_LABELS = {
  geological: 'Геологическая',
  hydrological: 'Гидрологическая',
  geomorphological: 'Геоморфологическая',
  geocryological: 'Геокриологическая',
  vegetation: 'Растительность',
  other: 'Другое',
} as const;

export const PERMAFROST_LABELS = {
  frozen: 'Мёрзлый',
  thawed: 'Талый',
  transitional: 'Переходный',
  unknown: 'Нет данных',
} as const;

export interface NavItem {
  href: string;
  label: string;
}

// Пункты верхней навигации (десктоп), раздел 12 ТЗ: Карта / Данные / Аналитика / Экспорт.
export const NAV_ITEMS: NavItem[] = [
  { href: '/map', label: 'Карта' },
  { href: '/data', label: 'Данные' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/export', label: 'Экспорт' },
];

export const ADMIN_NAV_ITEM: NavItem = { href: '/admin', label: 'Админ' };

// Нижняя навигация мобильной версии (раздел 7.2 ТЗ): Карта / Объекты / Съёмка / Ещё.
// "Съёмка" и "Ещё" пока указывают на ближайшие существующие разделы —
// полноценный флоу полевой съёмки появится на Этапе 2/3.
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: '/map', label: 'Карта' },
  { href: '/data', label: 'Объекты' },
  { href: '/data', label: 'Съёмка' }, // TODO(Этап 2): заменить на реальный маршрут полевой съёмки
  { href: '/analytics', label: 'Ещё' }, // TODO(Этап 2): заменить на реальный экран "Ещё"
];
