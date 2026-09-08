'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV_ITEMS } from '@/lib/constants';

// Нижняя навигация мобильной версии (раздел 7.2 ТЗ), кнопки ≥44px для
// работы в перчатках. "Съёмка"/"Ещё" временно указывают на существующие
// разделы (см. TODO в lib/constants.ts) — activeIndex берёт первое
// совпадение, чтобы при таком дублировании href не подсвечивались сразу
// два пункта одновременно.
export function MobileNav() {
  const pathname = usePathname();
  const activeIndex = MOBILE_NAV_ITEMS.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white md:hidden">
      {MOBILE_NAV_ITEMS.map((item, index) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          className={`flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 text-xs font-medium ${
            index === activeIndex ? 'text-header' : 'text-gray-500'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
