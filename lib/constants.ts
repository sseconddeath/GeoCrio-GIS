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

// В БД (CHECK-констрейнт profiles.role) есть три значения — оставлены
// для совместимости со старыми записями. В UI приложения показывается
// только два состояния: «Геолог» (обычный пользователь, все три роли БД
// схлопнуты в одну) и «Администратор» (модератор платформы).
export type UserRole = 'admin' | 'researcher' | 'student';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  researcher: 'Геолог',
  student: 'Геолог',
};

// Явное UI-разделение — используется на страницах, где важно различить
// обычного пользователя и админа (шапка, страницы админ-раздела).
export function displayRole(role: UserRole): 'Администратор' | 'Геолог' {
  return role === 'admin' ? 'Администратор' : 'Геолог';
}

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

// Пункты верхней навигации (десктоп). «Таблица» вместо «Данные» —
// раньше по названию «Данные» люди ждали сводную таблицу всех
// участков, а на самом деле это плоский список объектов ОДНОГО
// участка (переключаемого сверху).
export const NAV_ITEMS: NavItem[] = [
  { href: '/map', label: 'Карта' },
  { href: '/polygons', label: 'Участки' },
  { href: '/data', label: 'Таблица' },
  { href: '/inbox', label: 'Уведомления' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/export', label: 'Экспорт' },
];

export const ADMIN_NAV_ITEM: NavItem = { href: '/admin', label: 'Админ' };

// Нижняя навигация мобильной версии. Участки убраны — они и так
// доступны через переключатель в шапке, ссылка отдельным пунктом
// уводит из полевого потока. Оставляем то, что нужно в поле:
//   Карта    — главный экран
//   Данные   — таблица объектов участка (с ссылкой на Корзину)
//   Замеры   — заглушка? нет: /analytics — сводка по замерам
//   Правки   — /inbox с бейджем ожидающих
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: '/map', label: 'Карта' },
  { href: '/data', label: 'Таблица' },
  { href: '/analytics', label: 'Сводка' },
  { href: '/inbox', label: 'Правки' },
];
