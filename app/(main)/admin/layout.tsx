import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/supabase/profile';

// Server-side гейт: страница физически недостижима не-админом, а не просто
// скрыта из меню. getCurrentProfile() дедуплицирован через cache() — здесь
// не будет повторного запроса к БД поверх того, что уже сделал (main)/layout.tsx.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== 'admin') {
    redirect('/map');
  }

  return <>{children}</>;
}
