'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { POINT_TYPE_LABELS, SOIL_TYPE_LABELS } from '@/lib/constants';
import type { BoreholeRow, ObservationPointRow } from '@/lib/supabase/types';

interface ObjectsTableProps {
  boreholes: BoreholeRow[];
  points: ObservationPointRow[];
}

type Filter = 'all' | 'borehole' | 'observation_point';

interface Row {
  id: string;
  code: string;
  kind: 'borehole' | 'observation_point';
  typeLabel: string;
  extra: string;
  createdAt: string;
  href: string;
}

export function ObjectsTable({ boreholes, points }: ObjectsTableProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const rows: Row[] = useMemo(() => {
    const b: Row[] = boreholes.map((r) => ({
      id: r.id,
      code: r.code,
      kind: 'borehole',
      typeLabel: 'Скважина',
      extra: r.soil_type
        ? `${SOIL_TYPE_LABELS[r.soil_type as keyof typeof SOIL_TYPE_LABELS]}${
            r.depth_m != null ? ` · ${r.depth_m} м` : ''
          }`
        : r.depth_m != null
          ? `${r.depth_m} м`
          : '—',
      createdAt: r.created_at,
      href: `/boreholes/${r.id}`,
    }));
    const p: Row[] = points.map((r) => ({
      id: r.id,
      code: r.code,
      kind: 'observation_point',
      typeLabel: POINT_TYPE_LABELS[r.point_type as keyof typeof POINT_TYPE_LABELS],
      extra: '—',
      createdAt: r.created_at,
      href: `/observation-points/${r.id}`,
    }));
    return [...b, ...p].sort((a, b1) => a.code.localeCompare(b1.code));
  }, [boreholes, points]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.kind !== filter) return false;
      if (q && !r.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Поиск по коду…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-header/50"
        />
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {(['all', 'borehole', 'observation_point'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm ${
                filter === f ? 'bg-header text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'borehole' ? 'Скважины' : 'Точки'}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-500">Всего: {filtered.length}</div>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Код</th>
              <th className="px-4 py-2">Тип</th>
              <th className="px-4 py-2">Параметры</th>
              <th className="px-4 py-2">Создан</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Объекты не найдены.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={r.href} className="text-header hover:underline">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{r.typeLabel}</td>
                  <td className="px-4 py-2 text-gray-600">{r.extra}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
