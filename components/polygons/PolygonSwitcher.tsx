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

// Dropdown в шапке. При клике на пункт — навигация на текущую страницу с
// ?polygon=<id>. Работает на /map и /data — на других разделах селектор
// просто ведёт на /map?polygon=<id>. Активный полигон определяется
// самостоятельно по ?polygon=<id> — layout не может передать его пропом
// (в Next 16 layout не имеет доступа к searchParams).
export function PolygonSwitcher({
  myPolygons,
  sharedPolygons,
  publicPolygons,
}: PolygonSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePolygonId = searchParams.get('polygon') ?? undefined;
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
    const targetPath = pathname === '/data' || pathname === '/map' ? pathname : '/map';
    const params = new URLSearchParams(searchParams.toString());
    params.set('polygon', polygonId);
    router.push(`${targetPath}?${params.toString()}`);
    setOpen(false);
  };

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

          {myPolygons.length > 0 ? (
            <PolygonGroup
              title="Мои участки"
              polygons={myPolygons}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {sharedPolygons.length > 0 ? (
            <PolygonGroup
              title="Приглашения в команды"
              polygons={sharedPolygons}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {publicPolygons.length > 0 ? (
            <PolygonGroup
              title="Публичные участки"
              polygons={publicPolygons.map((p) => ({ ...p, is_public: true }))}
              activeId={activePolygonId}
              onPick={switchTo}
            />
          ) : null}

          {!hasAnything ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              У вас пока нет участков. Создайте первый или подождите
              приглашения от коллег.
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
