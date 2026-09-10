'use client';

import {
  createBoreholeFromQueue,
  updateBoreholeFromQueue,
  type BoreholeQueueInput,
} from '@/app/(main)/boreholes/actions';
import {
  createObservationPointFromQueue,
  updateObservationPointFromQueue,
  type ObservationPointQueueInput,
} from '@/app/(main)/observation-points/actions';
import { uploadPhotoAction, type UploadPhotoInput } from '@/app/(main)/photos/actions';
import { getDb, type SyncOperationKind, type SyncOperationRow } from './db';

// Клиентская очередь офлайн-мутаций.
//
// enqueue — кладёт операцию в IDB и (если сеть есть) сразу пытается
// слить очередь. drain — обходит очередь в порядке createdAt, для каждой
// операции вызывает соответствующий Server Action. Успех → удаляем
// запись; ошибка валидации/RLS → сохраняем error, оставляем в очереди
// с пометкой (пользователь увидит красный статус); сетевая ошибка →
// прерываем drain, попробуем позже.
//
// Одновременно drain выполняется в единственном экземпляре: если пришёл
// второй вызов пока первый ещё крутится — второй ждёт первый через
// общий Promise, чтобы не отправить одну и ту же операцию дважды.

export interface EnqueueBorehole {
  kind: 'borehole:create' | 'borehole:update';
  data: BoreholeQueueInput;
  targetId?: string;
}

export interface EnqueueObservationPoint {
  kind: 'observation_point:create' | 'observation_point:update';
  data: ObservationPointQueueInput;
  targetId?: string;
}

export interface EnqueuePhoto {
  kind: 'photo:upload';
  data: UploadPhotoInput;
}

export type EnqueueInput = EnqueueBorehole | EnqueueObservationPoint | EnqueuePhoto;

export async function enqueue(op: EnqueueInput): Promise<number> {
  const db = await getDb();
  const row: SyncOperationRow = {
    kind: op.kind,
    data: op.data as unknown as Record<string, unknown>,
    targetId: 'targetId' in op ? op.targetId : undefined,
    createdAt: Date.now(),
    attempts: 0,
  };
  const id = await db.add('sync_queue', row);
  notifyChange();
  return id as number;
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.count('sync_queue');
}

export async function listPending(): Promise<SyncOperationRow[]> {
  const db = await getDb();
  return db.getAllFromIndex('sync_queue', 'byCreatedAt');
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('sync_queue', id);
  notifyChange();
}

// ============================================================================
// Drain

export interface DrainReport {
  processed: number;
  failed: number;
  networkStopped: boolean;
}

let inflight: Promise<DrainReport> | null = null;

export function drain(): Promise<DrainReport> {
  if (inflight) return inflight;
  inflight = runDrain().finally(() => {
    inflight = null;
    notifyChange();
  });
  return inflight;
}

async function runDrain(): Promise<DrainReport> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { processed: 0, failed: 0, networkStopped: true };
  }
  const db = await getDb();
  const rows = await db.getAllFromIndex('sync_queue', 'byCreatedAt');
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.id === undefined) continue;
    try {
      const result = await runOperation(row.kind, row.data, row.targetId);
      if (result.ok) {
        await db.delete('sync_queue', row.id);
        processed++;
      } else {
        await db.put('sync_queue', {
          ...row,
          attempts: row.attempts + 1,
          lastError: result.error,
        });
        failed++;
      }
    } catch (err) {
      // Сетевая ошибка (TypeError: Failed to fetch и подобные). Ставим
      // на паузу — попробуем ещё раз при следующем online / клике.
      const message = err instanceof Error ? err.message : String(err);
      await db.put('sync_queue', {
        ...row,
        attempts: row.attempts + 1,
        lastError: message,
      });
      return { processed, failed: failed + 1, networkStopped: true };
    }
  }
  return { processed, failed, networkStopped: false };
}

async function runOperation(
  kind: SyncOperationKind,
  data: Record<string, unknown>,
  targetId?: string,
): Promise<{ ok: boolean; error?: string }> {
  switch (kind) {
    case 'borehole:create':
      return createBoreholeFromQueue(data as unknown as BoreholeQueueInput);
    case 'borehole:update':
      if (!targetId) return { ok: false, error: 'targetId отсутствует' };
      return updateBoreholeFromQueue(targetId, data as unknown as BoreholeQueueInput);
    case 'observation_point:create':
      return createObservationPointFromQueue(data as unknown as ObservationPointQueueInput);
    case 'observation_point:update':
      if (!targetId) return { ok: false, error: 'targetId отсутствует' };
      return updateObservationPointFromQueue(
        targetId,
        data as unknown as ObservationPointQueueInput,
      );
    case 'photo:upload': {
      const result = await uploadPhotoAction(data as unknown as UploadPhotoInput);
      return { ok: !!result.success, error: result.error };
    }
    default:
      return { ok: false, error: `Неизвестная операция: ${kind}` };
  }
}

// ============================================================================
// Подписка на изменения очереди — для SyncStatus.

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange(): void {
  for (const listener of listeners) listener();
}
