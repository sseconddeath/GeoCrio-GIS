import { signOutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS, type UserRole } from '@/lib/constants';
import { NavLinks } from './NavLinks';

interface HeaderProps {
  fullName: string;
  role: UserRole;
}

// Тёмная шапка #1a1f2e (раздел 12 ТЗ) — профессиональный вид, как у
// ArcGIS Online / QGIS Web.
export function Header({ fullName, role }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-header px-4 text-white md:px-6">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold">ГеоКрио ГИС</span>
        <div className="hidden md:block">
          <NavLinks isAdmin={role === 'admin'} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right text-sm sm:block">
          <div className="font-medium">{fullName}</div>
          <div className="text-white/60">{ROLE_LABELS[role]}</div>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Выйти
          </Button>
        </form>
      </div>
    </header>
  );
}
