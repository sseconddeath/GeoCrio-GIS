'use client';

import {
  BarChart3,
  Bell,
  Download,
  LayoutGrid,
  Map,
  Shield,
  Table,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEM, NAV_ITEMS, type NavItem } from '@/lib/constants';

// Соответствие href → иконка. Живёт в этом файле, чтобы NAV_ITEMS в
// constants.ts остался чистым (там только маршрутизация).
const NAV_ICONS: Record<string, LucideIcon> = {
  '/map': Map,
  '/polygons': LayoutGrid,
  '/data': Table,
  '/inbox': Bell,
  '/analytics': BarChart3,
  '/export': Download,
  '/admin': Shield,
};

// Единственный клиентский код в шапке — нужен для подсветки активного
// пункта и рендера бейджа непрочитанных на /inbox. Счётчик передаёт
// серверный Header (SSR-подсчёт), клиент только показывает.
export function NavLinks({
  isAdmin,
  inboxCount,
}: {
  isAdmin: boolean;
  inboxCount: number;
}) {
  const pathname = usePathname();
  const items: NavItem[] = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const showBadge = item.href === '/inbox' && inboxCount > 0;
        const Icon = NAV_ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ${
              active
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {Icon ? (
              <Icon
                size={16}
                strokeWidth={active ? 2.25 : 1.75}
                className={active ? '' : 'opacity-80 group-hover:opacity-100'}
                aria-hidden
              />
            ) : null}
            <span>{item.label}</span>
            {showBadge ? (
              <span
                aria-label={`Ожидают решения: ${inboxCount}`}
                className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm"
              >
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
