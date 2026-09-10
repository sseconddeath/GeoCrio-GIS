'use client';

import { useOffline } from 'next/offline';
import { useEffect, useState, useTransition } from 'react';
import { drain, enqueue } from '@/lib/offline/queue';
import { extractExifGps, resizeImage } from '@/lib/photo';
import { uploadPhotoAction } from '@/app/(main)/photos/actions';

interface PhotoUploaderProps {
  parent: { kind: 'borehole' | 'observation_point' | 'polygon'; id: string };
}

// Загрузка одного фото: пользователь выбирает файл (на телефоне это откроет
// камеру), фото сжимается в браузере до 1200px, генерируется thumbnail
// 300px, извлекается GPS из EXIF если есть — потом Server Action грузит
// в Storage и создаёт запись в photos.
export function PhotoUploader({ parent }: PhotoUploaderProps) {
  const [caption, setCaption] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const isOffline = useOffline();

  // «Снять на камеру» через <input capture> реально работает только на
  // мобилках с сенсорным экраном (Android/iOS). На десктопе тот же
  // атрибут просто открывает file picker — обещать съёмку в тексте
  // неправдиво. Определяем по media query pointer:coarse (сенсорный
  // основной ввод) — точнее, чем UA-sniff.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(pointer: coarse)');
    const update = () => setHasCamera(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSavedOffline(false);
    try {
      const [resized, gps] = await Promise.all([resizeImage(file), extractExifGps(file)]);
      const [fullBase64, thumbBase64] = await Promise.all([
        blobToDataUrl(resized.full),
        blobToDataUrl(resized.thumb),
      ]);
      const currentCaption = caption;
      const payload = {
        parent,
        fullBase64,
        thumbBase64,
        width: resized.width,
        height: resized.height,
        caption: currentCaption || undefined,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
      };
      startTransition(async () => {
        // Офлайн — кладём в IDB-очередь и говорим пользователю «отправится
        // позже». Фото ~150 KB (сжатое) + thumb, IDB спокойно берёт.
        if (isOffline) {
          await enqueue({ kind: 'photo:upload', data: payload });
          drain().catch(() => {});
          setSavedOffline(true);
          setCaption('');
          return;
        }
        const result = await uploadPhotoAction(payload);
        if (result.error) {
          setError(result.error);
        } else {
          setCaption('');
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать файл');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-900">Добавить фото</div>
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Подпись (необязательно): например «Керн 3–4 м»"
        className="min-h-[36px] rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-header/50"
        disabled={pending}
      />
      <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90">
        {pending
          ? isOffline
            ? 'Сохраняю локально…'
            : 'Загружаю…'
          : isOffline
            ? 'Выбрать фото — сохранится локально'
            : hasCamera
              ? 'Выбрать фото или снять на камеру'
              : 'Выбрать фото'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={pending}
          className="sr-only"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {savedOffline ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Фото сохранено локально. Отправится в общее хранилище, когда появится связь.
        </p>
      ) : null}
      <p className="text-xs text-gray-500">
        Фото сжимается на устройстве до ~1200 px. Если у снимка есть GPS-метка EXIF,
        она подтянется автоматически.
      </p>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
