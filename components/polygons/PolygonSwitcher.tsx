'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { PolygonRow } from '@/lib/supabase/types';

interface PolygonSwitcherProps {
  myPolygons: Pick<PolygonRow, 'id' | 'name' | 'is_public'>[];
  sharedPolygons: Pick<PolygonRow, 'id' | 'name' | 'is_public'>[];
  publicPolygons: Pick<PolygonRow, 'id' | 'name'>[];
}

// Dropdown в шапке. При клике на пункт — навигация с сохранением
// контекста текущей страницы: /map, /data, /analytics и /export
// принимают ?polygon=<id> и остаются на месте; со страниц /polygons/*
// и всего остального переключение уводит на /map (там участок = «где
// я сейчас работаю»).
//
// Активный полигон определяется по ?polygon=<id> из URL. При его
// отсутствии на /polygons/[id]/* — берём id из pathname. layout не
// может передать это пропом (в Next 16 layout не имеет доступа к
// searchParams).
export function PolygonSwitcher({
  myPolygons,
  sharedPolygons,
  publicPolygons,
}: PolygonSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Активный полигон: сначала ?polygon=<id>, потом — сегмент пути
  // /polygons/<id>/... (для страниц отдельного участка).
  const polygonInPath = /^\/polygons\/([0-9a-f-]{36})/.exec(pathname)?.[1];
  const activePolygonId = searchParams.get('polygon') ?? polygonInPath ?? undefined;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active =
    myPolygons.find((p) => p.id === activePolygonId) ??
    sharedPolygons.find((p) => p.id === activePolygonId) ??
    publicPolygons.find((p) => p.id === activePolygonId) ??
    null;

  const switchTo = (polygonId: string) => {
    // Страницы, где ?polygon=<id> имеет смысл — остаёмся на месте.
    // /polygons/<id>/... — переключаемся на карту нового участка
    // (сама страница участка про конкретный id, там смена участка
    // = уход на другой участок).
    const POLYGON_AWARE = new Set(['/map', '/data', '/analytics', '/export']);
    const targetPath = POLYGON_AWARE.has(pathname) ? pathname : '/map';
    const params = new URLSearchParams(searchParams.toString());
    params.set('polygon', polygonId);
    router.push(`${targetPath}?${params.toString()}`);
    setOpen(false);
    setQuery('');
  };

  // Простой clientside-фильтр по началу/содержанию названия.
  // Оживает только когда суммарно ≥8 участков — на маленьких списках
  // строка поиска только мешает.
  const totalCount =
    myPolygons.length + sharedPolygons.length + publicPolygons.length;
  const needle = query.trim().toLowerCase();
  const filter = <T extends { name: string }>(rows: T[]) =>
    needle === '' ? rows : rows.filter((r) => r.name.toLowerCase().includes(needle));
  const filteredMy = filter(myPolygons);
  const filteredShared = filter(sharedPolygons);
  const filteredPublic = filter(publicPolygons);

  const hasAnything = myPolygons.length + sharedPolygons.length + publicPolygons.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[36px] items-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-1 text-sm text-white hover:bg-white/10"
      >
        <span className="max-w-[180px] truncate">
          {active?.name ?? (hasAnything ? 'Выбрать участок' : 'Нет участков')}
        </span>
        <span className="text-white/60">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-[70vh] w-72 overflow-auto rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg">
          <Link
            href="/polygons/new"
            onClick={() => setOpen(false)}
            className="block border-b border-gray-100 px-4 py-2 text-sm font-medium text-header hover:bg-gray-50"
          >
            + Новый участок
          </Link>

          {totalCount >= 8 ? (
            <div className="border-b border-gray-100 p-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию…"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-header/50"
              />
            </div>
          ) : null}

          {filteredMy.length > 0 ? (
            <PolygonGroup
              title="Мои участки"
              polygons={filteredMy}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {filteredShared.length > 0 ? (
            <PolygonGroup
              title="Приглашения в команды"
              polygons={filteredShared}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {filteredPublic.length > 0 ? (
            <PolygonGroup
              title="Публичные участки"
              polygons={filteredPublic.map((p) => ({ ...p, is_public: true }))}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {!hasAnything ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              У вас пока нет участков. Создайте первый или подождите
              приглашения от коллег.
            </p>
          ) : hasAnything &&
            filteredMy.length + filteredShared.length + filteredPublic.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              По запросу «{query}» ничего не найдено.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PolygonGroup({
  title,
  polygons,
  activeId,
  onPick,
}: {
  title: string;
  polygons: Pick<PolygonRow, 'id' | 'name' | 'is_public'>[];
  activeId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="border-b border-gray-100 py-1">
      <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </div>
      {polygons.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
            p.id === activeId ? 'bg-header/5 font-medium text-header' : ''
          }`}
        >
          <span className="truncate flex-1">{p.name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              p.is_public ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {p.is_public ? 'публ.' : 'приват'}
          </span>
        </button>
      ))}
    </div>
  );
}
