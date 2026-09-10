'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV_ITEMS } from '@/lib/constants';

// Нижняя навигация мобильной версии (раздел 7.2 ТЗ), кнопки ≥44px для
// работы в перчатках. inboxCount передаётся сверху (server-side считает
// в layout), пункт «Правки» (/inbox) получает красный бейдж, когда
// есть входящие предложения по объектам пользователя.
export function MobileNav({ inboxCount }: { inboxCount: number }) {
  const pathname = usePathname();
  const activeIndex = MOBILE_NAV_ITEMS.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white md:hidden">
      {MOBILE_NAV_ITEMS.map((item, index) => {
        const showBadge = item.href === '/inbox' && inboxCount > 0;
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 text-xs font-medium ${
              index === activeIndex ? 'text-header' : 'text-gray-500'
            }`}
          >
            {item.label}
            {showBadge ? (
              <span
                aria-label={`Ожидают решения: ${inboxCount}`}
                className="absolute right-4 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
              >
                {inboxCount > 9 ? '9+' : inboxCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
