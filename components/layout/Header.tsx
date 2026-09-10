import { signOutAction } from '@/app/(auth)/actions';
import { PolygonSwitcher } from '@/components/polygons/PolygonSwitcher';
import { Button } from '@/components/ui/Button';
import { displayRole, type UserRole } from '@/lib/constants';
import {
  listMyPolygons,
  listPublicPolygons,
  listSharedWithMePolygons,
} from '@/lib/supabase/queries';
import { NavLinks } from './NavLinks';

interface HeaderProps {
  fullName: string;
  role: UserRole;
}

// Тёмная шапка #1a1f2e — тот же дизайн, что и раньше, только теперь между
// логотипом и правой группой встроен переключатель активного участка.
// Списки участков грузятся серверно (кэшируются React'ом через cache()) —
// клиентский PolygonSwitcher получает уже готовые пропсы, а активный
// polygon сам достаёт из URL (?polygon=<id>).
export async function Header({ fullName, role }: HeaderProps) {
  const [myPolygons, sharedPolygons, publicPolygons] = await Promise.all([
    listMyPolygons(),
    listSharedWithMePolygons(),
    listPublicPolygons(),
  ]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 bg-header px-4 text-white md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="hidden text-lg font-semibold sm:block">ГеоКрио ГИС</span>
        <div className="hidden md:block">
          <NavLinks isAdmin={role === 'admin'} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <PolygonSwitcher
          myPolygons={myPolygons.map((p) => ({ id: p.id, name: p.name, is_public: p.is_public }))}
          sharedPolygons={sharedPolygons.map((p) => ({
            id: p.id,
            name: p.name,
            is_public: p.is_public,
          }))}
          publicPolygons={publicPolygons
            .slice(0, 20)
            .map((p) => ({ id: p.id, name: p.name }))}
        />
        <div className="hidden text-right text-sm sm:block">
          <div className="max-w-[160px] truncate font-medium">{fullName}</div>
          <div className="text-white/60">{displayRole(role)}</div>
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
