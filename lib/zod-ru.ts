import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

// Русскоязычные default-сообщения для zod. Наша validation.ts во многих
// местах передаёт свои message'и — они всегда побеждают. Этот errorMap
// покрывает только те кейсы, где мы полагаемся на default (например,
// `z.enum([...])` без явного `{ message }` — раньше давал «Invalid enum
// value. Expected ...»; теперь пользователь видит человеческий текст).
//
// Один раз в процессе (SSR и client) вызывается z.setErrorMap ниже.

const RU_TYPES: Record<string, string> = {
  string: 'строка',
  number: 'число',
  integer: 'целое число',
  boolean: 'логическое значение',
  date: 'дата',
  bigint: 'большое число',
  array: 'массив',
  object: 'объект',
  null: 'пусто',
  undefined: 'не задано',
  nan: 'не число',
  void: 'ничего',
  never: 'ничего',
  map: 'словарь',
  function: 'функция',
  symbol: 'символ',
  set: 'множество',
  unknown: 'значение',
};

function ruType(t: string): string {
  return RU_TYPES[t] ?? t;
}

// Форматируем список допустимых значений, обрезая слишком длинные списки.
function fmtEnum(options: (string | number)[]): string {
  const first = options.slice(0, 6).map((v) => `«${v}»`).join(', ');
  return options.length > 6 ? `${first}, …` : first;
}

const errorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Обязательное поле' };
      }
      return {
        message: `Ожидается ${ruType(issue.expected)}, получено ${ruType(issue.received)}`,
      };
    case ZodIssueCode.invalid_literal:
      return { message: `Ожидается значение ${JSON.stringify(issue.expected)}` };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Допустимые значения: ${fmtEnum(issue.options)}` };
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: 'Некорректный формат' };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Неизвестные поля: ${issue.keys.join(', ')}` };
    case ZodIssueCode.invalid_arguments:
      return { message: 'Некорректные аргументы' };
    case ZodIssueCode.invalid_return_type:
      return { message: 'Некорректный возвращаемый тип' };
    case ZodIssueCode.invalid_date:
      return { message: 'Некорректная дата' };
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === 'object') {
        return { message: 'Некорректный формат строки' };
      }
      switch (issue.validation) {
        case 'email':
          return { message: 'Введите корректный email' };
        case 'url':
          return { message: 'Введите корректный URL' };
        case 'uuid':
        case 'nanoid':
        case 'cuid':
        case 'cuid2':
        case 'ulid':
          return { message: 'Некорректный идентификатор' };
        case 'regex':
          return { message: 'Значение не соответствует формату' };
        case 'datetime':
          return { message: 'Некорректные дата и время' };
        case 'date':
          return { message: 'Некорректная дата' };
        case 'time':
          return { message: 'Некорректное время' };
        default:
          return { message: 'Некорректный формат' };
      }
    case ZodIssueCode.too_small: {
      const min = String(issue.minimum);
      if (issue.type === 'string') {
        return { message: `Минимум ${min} символ(ов)` };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Число не меньше ${min}` };
      }
      if (issue.type === 'array') {
        return { message: `Минимум ${min} элемент(ов)` };
      }
      if (issue.type === 'date') {
        return { message: 'Слишком ранняя дата' };
      }
      return { message: `Значение слишком мало (минимум ${min})` };
    }
    case ZodIssueCode.too_big: {
      const max = String(issue.maximum);
      if (issue.type === 'string') {
        return { message: `Максимум ${max} символ(ов)` };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Число не больше ${max}` };
      }
      if (issue.type === 'array') {
        return { message: `Максимум ${max} элемент(ов)` };
      }
      if (issue.type === 'date') {
        return { message: 'Слишком поздняя дата' };
      }
      return { message: `Значение слишком велико (максимум ${max})` };
    }
    case ZodIssueCode.not_multiple_of:
      return { message: `Значение должно быть кратно ${issue.multipleOf}` };
    case ZodIssueCode.not_finite:
      return { message: 'Значение должно быть конечным числом' };
    case ZodIssueCode.custom:
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

// Идемпотентно — импорт этого модуля просто устанавливает map. Никаких
// сайд-эффектов при повторном импорте (setErrorMap перезатирает).
z.setErrorMap(errorMap);

export {};
