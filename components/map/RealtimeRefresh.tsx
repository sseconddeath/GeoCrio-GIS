'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RealtimeRefreshProps {
  polygonId: string;
}

// Подписка на изменения в boreholes и observation_points ЛЮБОГО полигона
// (Supabase Realtime не умеет фильтровать по колонке в бесплатном тарифе
// per row — фильтруем на клиенте по polygon_id из payload). При изменении
// вызывает router.refresh() — Next перерендерит серверный компонент и
// подтянет свежие объекты через getMapObjectsGeoJSON.
//
// Компонент невидимый, монтируется в MapWorkspace для активного участка.
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
      .subscribe();

    // Троттлинг: не бомбардируем сервер refresh'ами, если пришёл всплеск
    // событий (например 5 замеров подряд из мобильного офлайн-sync). Один
    // refresh не чаще раза в секунду.
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
