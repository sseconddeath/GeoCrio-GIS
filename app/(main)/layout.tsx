import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { getCurrentProfile } from '@/lib/supabase/profile';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // Защита в глубину поверх proxy.ts — proxy уже не пускает сюда без сессии,
  // это дублирование дёшево и подстраховывает от прямого server-side рендера
  // layout в обход proxy.
  if (!profile) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header fullName={profile.full_name} role={profile.role} />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
