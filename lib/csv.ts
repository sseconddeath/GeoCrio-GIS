// Минималистичный CSV-парсер без сторонних зависимостей.
//
// Поддерживает:
//  - разделители ',' и ';' (по умолчанию — авто-детект по первой строке);
//  - двойные кавычки для полей с разделителем/переносом строки;
//  - escaped кавычки "" внутри поля;
//  - UTF-8 BOM в начале файла (Excel добавляет);
//  - разрывы строк \n и \r\n.
//
// Возвращает массив массивов строк. Проверку заголовков / нормализацию
// значений делает вызывающий (см. lib/csv-mapping.ts).

export function parseCsv(input: string): string[][] {
  // Снимаем BOM, если есть.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.trim() === '') return [];

  // Определяем разделитель по первой строке (без учёта содержимого
  // в кавычках — грубо, но достаточно). Если ';' встречается вне
  // кавычек хотя бы раз, считаем ';' разделителем, иначе ','.
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      current.push(field);
      field = '';
      continue;
    }
    if (ch === '\r') {
      // Пропускаем \r — реальный разрыв обработаем на \n.
      continue;
    }
    if (ch === '\n') {
      current.push(field);
      field = '';
      // Игнорируем полностью пустые строки — Excel часто оставляет
      // хвост в конце файла.
      if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
        rows.push(current);
      }
      current = [];
      continue;
    }
    field += ch;
  }
  // Последнее поле / последняя строка без завершающего \n.
  if (field !== '' || current.length > 0) {
    current.push(field);
    if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
      rows.push(current);
    }
  }
  return rows;
}

function detectDelimiter(text: string): ',' | ';' {
  let semis = 0;
  let commas = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ';') semis++;
    else if (ch === ',') commas++;
    else if (ch === '\n') break;
  }
  return semis > commas ? ';' : ',';
}

// Нормализация заголовков: убираем пробелы, приводим к нижнему регистру,
// заменяем ё→е (Excel часто сохраняет «широта» через ё).
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}
