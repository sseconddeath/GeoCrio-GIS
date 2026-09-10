// Клиентские утилиты для обработки фото перед загрузкой.
// Полевой геолог фотографирует на телефон — файл может быть 5-10 МБ, а
// нам достаточно 1200 px по длинной стороне (для документирования
// скважины/точки), плюс thumbnail 300 px для превью на карте/в галерее.

export interface ResizedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export async function resizeImage(
  file: File,
  { maxLong = 1200, thumbLong = 300, quality = 0.85 } = {},
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const full = await drawScaled(bitmap, maxLong, quality);
  const thumb = await drawScaled(bitmap, thumbLong, quality);
  const width = full.width;
  const height = full.height;
  bitmap.close();
  return { full: full.blob, thumb: thumb.blob, width, height };
}

async function drawScaled(
  bitmap: ImageBitmap,
  maxLong: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxLong / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать canvas-контекст');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, width, height };
}

// Пробуем достать GPS-координаты из EXIF (если сделано на телефоне с
// включённой геотеговостью). Простой ручной парсер без библиотек — работает
// не идеально, но покрывает 95% реальных JPEG из современных телефонов.
// В случае неудачи возвращает null — форма подставит текущее место (клик
// по карте или GPS-кнопка).
export async function extractExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  if (!file.type.startsWith('image/jpeg')) return null;
  const buf = await file.slice(0, 128 * 1024).arrayBuffer();
  const view = new DataView(buf);
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) {
      const start = offset + 4;
      if (view.getUint32(start) !== 0x45786966) return null;
      return parseTiffGps(view, start + 6);
    }
    if ((marker & 0xff00) !== 0xff00) return null;
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}

function parseTiffGps(view: DataView, tiffStart: number): { lat: number; lng: number } | null {
  const little = view.getUint16(tiffStart) === 0x4949;
  const get16 = (o: number) => view.getUint16(o, little);
  const get32 = (o: number) => view.getUint32(o, little);
  if (get16(tiffStart + 2) !== 0x002a) return null;
  const ifd0Offset = tiffStart + get32(tiffStart + 4);
  const ifd0Count = get16(ifd0Offset);
  let gpsIfdOffset = 0;
  for (let i = 0; i < ifd0Count; i++) {
    const entry = ifd0Offset + 2 + i * 12;
    if (get16(entry) === 0x8825) {
      gpsIfdOffset = tiffStart + get32(entry + 8);
      break;
    }
  }
  if (!gpsIfdOffset) return null;
  const count = get16(gpsIfdOffset);
  let latRef = '', lngRef = '', lat = 0, lng = 0;
  for (let i = 0; i < count; i++) {
    const entry = gpsIfdOffset + 2 + i * 12;
    const tag = get16(entry);
    const value32 = get32(entry + 8);
    if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(entry + 8));
    else if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(entry + 8));
    else if (tag === 0x0002) lat = readRational3(view, tiffStart + value32, little);
    else if (tag === 0x0004) lng = readRational3(view, tiffStart + value32, little);
  }
  if (!latRef || !lngRef) return null;
  return {
    lat: latRef === 'S' ? -lat : lat,
    lng: lngRef === 'W' ? -lng : lng,
  };
}

function readRational3(view: DataView, offset: number, little: boolean): number {
  const g = (o: number) => view.getUint32(o, little);
  const deg = g(offset) / g(offset + 4);
  const min = g(offset + 8) / g(offset + 12);
  const sec = g(offset + 16) / g(offset + 20);
  return deg + min / 60 + sec / 3600;
}
