// Утилиты для нормализации ввода координат. Чистые функции — юнит-тестируются
// отдельно (см. lib/coords.test.ts).

// Нормализует пользовательский ввод: запятая → точка (типичная ошибка на
// русской раскладке), убирает лишние пробелы и невидимые unicode-символы.
// Возвращает строку в форме, которую примут HTML input type="number" и
// парсер `Number()`.
export function normalizeCoordInput(raw: string): string {
  return raw
    .replace(/ /g, '') // NBSP (часто прилетает при копипасте из документов)
    .replace(/,/g, '.')
    .trim();
}

// Валидация одного значения координаты. Возвращает { value, error }.
// error === null означает, что value можно использовать.
export function parseCoord(
  raw: string,
  kind: 'lat' | 'lng',
): { value: number | null; error: string | null } {
  const normalized = normalizeCoordInput(raw);
  if (normalized === '') return { value: null, error: null };
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return { value: null, error: 'Введите число (например 57.20123)' };
  }
  const [min, max] = kind === 'lat' ? [-90, 90] : [-180, 180];
  if (n < min || n > max) {
    return {
      value: null,
      error: kind === 'lat'
        ? 'Широта должна быть в диапазоне −90 … 90'
        : 'Долгота должна быть в диапазоне −180 … 180',
    };
  }
  return { value: n, error: null };
}

// Форматирование accuracy GPS-замера для показа под кнопкой.
export function formatAccuracy(meters: number): string {
  if (meters < 10) return `±${meters.toFixed(0)} м (хорошо)`;
  if (meters < 30) return `±${meters.toFixed(0)} м (нормально)`;
  return `±${meters.toFixed(0)} м (слабо — попробуйте выйти на открытое место)`;
}
