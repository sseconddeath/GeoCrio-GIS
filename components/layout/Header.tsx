import { LogOut, Mountain } from 'lucide-react';
import Link from 'next/link';
import { signOutAction } from '@/app/(auth)/actions';
import { PolygonSwitcher } from '@/components/polygons/PolygonSwitcher';
import { SyncStatus } from '@/components/pwa/SyncStatus';
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
  inboxCount: number;
}

// Тёмная шапка #1a1f2e — тот же дизайн, что и раньше, только теперь между
// логотипом и правой группой встроен переключатель активного участка.
// Списки участков грузятся серверно (кэшируются React'ом через cache()) —
// клиентский PolygonSwitcher получает уже готовые пропсы, а активный
// polygon сам достаёт из URL (?polygon=<id>).
export async function Header({ fullName, role, inboxCount }: HeaderProps) {
  const [myPolygons, sharedPolygons, publicPolygons] = await Promise.all([
    listMyPolygons(),
    listSharedWithMePolygons(),
    listPublicPolygons(),
  ]);

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 bg-header px-4 text-white md:px-6"
      style={{
        // Учитываем «челку» iPhone: сама шапка едет под status bar
        // (viewport-fit=cover), но контент внутри — ниже notch'а.
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
        paddingBottom: '0.5rem',
        minHeight: 'calc(4rem + env(safe-area-inset-top))',
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/map" className="flex items-center gap-2 shrink-0" aria-label="ГеоКрио ГИС">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-borehole/20 ring-1 ring-borehole/40">
            <Mountain size={20} className="text-borehole" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:block">ГеоКрио</span>
        </Link>
        <div className="hidden md:block">
          <NavLinks isAdmin={role === 'admin'} inboxCount={inboxCount} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <SyncStatus />
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
          <div className="max-w-[160px] truncate font-medium leading-tight">{fullName}</div>
          <div className="text-xs text-white/60 leading-tight">{displayRole(role)}</div>
        </div>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="inline-flex items-center gap-1.5"
            aria-label="Выйти"
          >
            <LogOut size={16} aria-hidden />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
