'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEM, NAV_ITEMS, type NavItem } from '@/lib/constants';

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
    <nav className="flex gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const showBadge = item.href === '/inbox' && inboxCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.label}
            {showBadge ? (
              <span
                aria-label={`Ожидают решения: ${inboxCount}`}
                className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
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
