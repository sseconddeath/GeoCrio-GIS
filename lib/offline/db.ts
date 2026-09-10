'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Локальная БД в браузере для офлайн-очереди мутаций. Одна база
// geokrio-offline, версия 1. Sync-queue — auto-increment id, чтобы
// сохранять порядок вставки.
//
// Мы не храним читаемые данные (список скважин, фото и т.д.) — за них
// отвечает Service Worker (плитки) и Next.js prefetch (App Shell +
// useOffline). Здесь только очередь мутаций, которую нужно донести до
// сервера, когда сеть вернётся.

export type SyncOperationKind =
  | 'borehole:create'
  | 'borehole:update'
  | 'observation_point:create'
  | 'observation_point:update'
  | 'photo:upload';

export interface SyncOperationRow {
  id?: number;
  kind: SyncOperationKind;
  // JSON-совместимый payload. Для форм — {polygonId, code, lat, ...},
  // для фото — {parent, fullBase64, thumbBase64, width, height, ...}.
  // Идентификатор редактируемой сущности (для *:update) кладём отдельно
  // в targetId — так проще резолвить в drain.
  data: Record<string, unknown>;
  targetId?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

interface GeoKrioOfflineDB extends DBSchema {
  sync_queue: {
    key: number;
    value: SyncOperationRow;
    indexes: { byCreatedAt: 'createdAt' };
  };
}

const DB_NAME = 'geokrio-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GeoKrioOfflineDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<GeoKrioOfflineDB>> {
  if (typeof window === 'undefined') {
    // На сервере IDB нет — модули не должны вызывать это в SSR.
    return Promise.reject(new Error('IndexedDB is not available in SSR'));
  }
  if (!dbPromise) {
    dbPromise = openDB<GeoKrioOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('byCreatedAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}
