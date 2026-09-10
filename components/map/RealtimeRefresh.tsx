'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RealtimeRefreshProps {
  polygonId: string;
}

// Подписка на изменения основных сущностей активного полигона.
// boreholes и observation_points имеют колонку polygon_id — фильтруем
// прямо в подписке. measurements и photos связаны через borehole_id /
// observation_point_id и не имеют polygon_id (кроме случая фото
// «на полигон» — но это редкий кейс) — подписываемся без фильтра,
// Supabase Realtime применит RLS и отсеет всё, что клиент не видит.
// Троттлинг 1 сек защищает от спама (5 замеров подряд из offline-sync).
//
// Зачем и measurements: они меняют вычисляемое поле permafrost_status
// в map_objects view — то есть цвет маркера на карте. Без подписки
// команда участка не увидит, что коллега завёл замер, до ручного
// F5. То же с photos для счётчика в статистике.
export function RealtimeRefresh({ polygonId }: RealtimeRefreshProps) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`polygon-${polygonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boreholes', filter: `polygon_id=eq.${polygonId}` },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'observation_points',
          filter: `polygon_id=eq.${polygonId}`,
        },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'measurements' },
        () => scheduleRefresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        () => scheduleRefresh(),
      )
      .subscribe();

    function scheduleRefresh() {
      const now = Date.now();
      const since = now - lastRefreshRef.current;
      if (since < 1000) return;
      lastRefreshRef.current = now;
      router.refresh();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [polygonId, router]);

  return null;
}
