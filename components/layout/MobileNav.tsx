'use client';

import { BarChart3, Bell, Map, Table, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV_ITEMS } from '@/lib/constants';

const MOBILE_ICONS: Record<string, LucideIcon> = {
  '/map': Map,
  '/data': Table,
  '/analytics': BarChart3,
  '/inbox': Bell,
};

// Нижняя навигация мобильной версии (раздел 7.2 ТЗ), кнопки ≥44px для
// работы в перчатках. Иконка над лейблом — понятнее чем один текст.
// inboxCount передаётся сверху (server-side считает в layout), пункт
// «Правки» (/inbox) получает красный бейдж на иконке, когда есть
// входящие предложения по объектам пользователя.
export function MobileNav({ inboxCount }: { inboxCount: number }) {
  const pathname = usePathname();
  const activeIndex = MOBILE_NAV_ITEMS.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {MOBILE_NAV_ITEMS.map((item, index) => {
        const showBadge = item.href === '/inbox' && inboxCount > 0;
        const active = index === activeIndex;
        const Icon = MOBILE_ICONS[item.href];
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
              active ? 'text-header' : 'text-gray-500'
            }`}
          >
            <div className="relative">
              {Icon ? (
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              ) : null}
              {showBadge ? (
                <span
                  aria-label={`Ожидают решения: ${inboxCount}`}
                  className="absolute -right-2 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow"
                >
                  {inboxCount > 9 ? '9+' : inboxCount}
                </span>
              ) : null}
            </div>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
