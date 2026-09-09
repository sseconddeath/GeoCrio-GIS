import type { PostgrestError } from '@supabase/supabase-js';

// Переводит ошибки PostgREST/PostgreSQL в понятные русскоязычные сообщения.
// Триггерные RAISE EXCEPTION (P0001) уже содержат русский текст на сервере
// (см. миграцию 001: "Точка за пределами полигона (буфер 500м)", "Недостаточно
// прав для изменения роли пользователя") — выводим как есть.
export function translateDbError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      // UNIQUE violation — единственное место, где сейчас может сработать, —
      // UNIQUE (polygon_id, code) в boreholes/observation_points.
      if (error.message.includes('polygon_id') && error.message.includes('code')) {
        return 'Объект с таким кодом уже существует в этом полигоне';
      }
      return 'Такая запись уже существует';
    case '23514':
      // CHECK constraint — глубина/температура/зумы вне диапазона.
      return 'Одно из полей вне допустимого диапазона (см. подсказки к форме)';
    case '23503':
      // Foreign key violation.
      return 'Ссылка на несуществующий объект';
    case '42501':
      // Insufficient privilege — по факту RLS.
      return 'Недостаточно прав для этого действия';
    case 'PGRST301':
    case 'PGRST116':
      return 'Запись не найдена или недоступна';
    case 'P0001':
      // RAISE EXCEPTION из триггера — сообщение уже на русском.
      return error.message;
    default:
      return `Ошибка базы данных: ${error.message}`;
  }
}
