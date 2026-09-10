'use client';

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { deletePhotoAction } from '@/app/(main)/photos/actions';
import type { PhotoWithUrls } from '@/lib/supabase/queries';

interface PhotoGalleryProps {
  photos: PhotoWithUrls[];
  parent: { kind: 'borehole' | 'observation_point'; id: string };
  canEdit: boolean;
}

export function PhotoGallery({ photos, parent, canEdit }: PhotoGalleryProps) {
  const [lightbox, setLightbox] = useState<PhotoWithUrls | null>(null);
  const [pendingId, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PhotoWithUrls | null>(null);
  const { showToast } = useToast();

  if (photos.length === 0) return null;

  const runDelete = (photo: PhotoWithUrls) => {
    setBusyId(photo.id);
    startTransition(async () => {
      const result = await deletePhotoAction(photo.id, parent);
      setBusyId(null);
      setConfirmDelete(null);
      if (result.ok) {
        showToast({ kind: 'success', message: 'Фото удалено.' });
      } else {
        showToast({ kind: 'error', message: result.error ?? 'Не удалось удалить' });
      }
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-gray-900">Фото ({photos.length})</div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.id} className="group relative overflow-hidden rounded-md border border-gray-200 bg-gray-100">
            {photo.thumbUrl ? (
              <button
                type="button"
                onClick={() => setLightbox(photo)}
                className="block w-full"
                aria-label={photo.caption ?? 'Открыть фото'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl}
                  alt={photo.caption ?? 'Фото объекта'}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="flex h-32 w-full items-center justify-center text-xs text-gray-400">
                нет превью
              </div>
            )}
            {photo.caption ? (
              <div className="border-t border-gray-100 p-2 text-xs text-gray-700 line-clamp-2">
                {photo.caption}
              </div>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(photo)}
                disabled={pendingId && busyId === photo.id}
                className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-0.5 text-xs text-red-600 opacity-0 shadow group-hover:opacity-100 disabled:opacity-50"
              >
                Удалить
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {lightbox?.fullUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.fullUrl}
            alt={lightbox.caption ?? 'Фото'}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Удалить фото?"
        description={
          confirmDelete?.caption
            ? `«${confirmDelete.caption}». Файл будет удалён из хранилища без возможности восстановить.`
            : 'Файл будет удалён из хранилища без возможности восстановить.'
        }
        confirmLabel="Удалить"
        danger
        pending={pendingId && busyId === confirmDelete?.id}
        onConfirm={() => confirmDelete && runDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

