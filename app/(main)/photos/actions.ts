'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/supabase/db-errors';

export interface UploadPhotoState {
  error?: string;
  success?: boolean;
}

export interface UploadPhotoInput {
  parent: { kind: 'borehole' | 'observation_point' | 'polygon'; id: string };
  fullBase64: string; // data:image/jpeg;base64,...
  thumbBase64: string;
  width: number;
  height: number;
  caption?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
}

function base64ToBlob(dataUrl: string): { blob: Blob; sizeKb: number } {
  const [, b64] = dataUrl.split(',');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), sizeKb: Math.round(bytes.length / 1024) };
}

// Загружает fullsize+thumb в Storage, потом создаёт запись в photos.
// Полигон, к которому фото привязано (borehole → его polygon_id;
// observation_point → его polygon_id; polygon → сам), нужен и для
// path в Storage, и для revalidatePath.
export async function uploadPhotoAction(input: UploadPhotoInput): Promise<UploadPhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Требуется вход в систему' };

  let polygonId: string | null = null;
  if (input.parent.kind === 'polygon') {
    polygonId = input.parent.id;
  } else if (input.parent.kind === 'borehole') {
    const { data } = await supabase
      .from('boreholes')
      .select('polygon_id')
      .eq('id', input.parent.id)
      .maybeSingle();
    polygonId = (data as { polygon_id: string } | null)?.polygon_id ?? null;
  } else {
    const { data } = await supabase
      .from('observation_points')
      .select('polygon_id')
      .eq('id', input.parent.id)
      .maybeSingle();
    polygonId = (data as { polygon_id: string } | null)?.polygon_id ?? null;
  }
  if (!polygonId) return { error: 'Родительский объект не найден' };

  const { blob: fullBlob, sizeKb } = base64ToBlob(input.fullBase64);
  const { blob: thumbBlob } = base64ToBlob(input.thumbBase64);

  const filename = `${crypto.randomUUID()}.jpg`;
  const objectPath = `${polygonId}/${input.parent.kind}/${input.parent.id}/${filename}`;
  const thumbPath = `${polygonId}/${input.parent.kind}/${input.parent.id}/thumb_${filename}`;

  const [fullUp, thumbUp] = await Promise.all([
    supabase.storage.from('photos').upload(objectPath, fullBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    }),
    supabase.storage.from('thumbnails').upload(thumbPath, thumbBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    }),
  ]);
  if (fullUp.error) return { error: `Не удалось загрузить фото: ${fullUp.error.message}` };
  if (thumbUp.error) {
    // Откатываем полноразмерное фото, чтобы не осталось «сироты».
    await supabase.storage.from('photos').remove([objectPath]);
    return { error: `Не удалось загрузить превью: ${thumbUp.error.message}` };
  }

  const insertPayload = {
    borehole_id: input.parent.kind === 'borehole' ? input.parent.id : null,
    observation_point_id: input.parent.kind === 'observation_point' ? input.parent.id : null,
    polygon_id: input.parent.kind === 'polygon' ? input.parent.id : null,
    storage_path: objectPath,
    thumbnail_path: thumbPath,
    caption: input.caption ?? null,
    file_size_kb: sizeKb,
    width_px: input.width,
    height_px: input.height,
    location:
      input.gpsLat != null && input.gpsLng != null
        ? `SRID=4326;POINT(${input.gpsLng} ${input.gpsLat})`
        : null,
    taken_at: new Date().toISOString(),
    uploaded_by: user.id,
  };
  const { error } = await supabase.from('photos').insert(insertPayload);
  if (error) {
    await Promise.all([
      supabase.storage.from('photos').remove([objectPath]),
      supabase.storage.from('thumbnails').remove([thumbPath]),
    ]);
    return { error: translateDbError(error) };
  }

  if (input.parent.kind === 'borehole') {
    revalidatePath(`/boreholes/${input.parent.id}`);
  } else if (input.parent.kind === 'observation_point') {
    revalidatePath(`/observation-points/${input.parent.id}`);
  }
  revalidatePath('/map');
  return { success: true };
}

export async function deletePhotoAction(id: string, parent: {
  kind: 'borehole' | 'observation_point';
  id: string;
}): Promise<void> {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from('photos')
    .select('storage_path, thumbnail_path')
    .eq('id', id)
    .maybeSingle();
  const p = photo as { storage_path: string; thumbnail_path: string | null } | null;
  if (p) {
    await Promise.all([
      supabase.storage.from('photos').remove([p.storage_path]),
      p.thumbnail_path ? supabase.storage.from('thumbnails').remove([p.thumbnail_path]) : null,
    ]);
  }
  await supabase.from('photos').delete().eq('id', id);
  if (parent.kind === 'borehole') {
    revalidatePath(`/boreholes/${parent.id}`);
  } else {
    revalidatePath(`/observation-points/${parent.id}`);
  }
  revalidatePath('/map');
}
