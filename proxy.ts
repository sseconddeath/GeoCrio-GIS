import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthRoute, isProtectedRoute, isSafeRedirectTarget } from './lib/routes';

// Next.js 16: файловое соглашение "middleware" переименовано в "proxy"
// (сама функция может называться как угодно при экспорте по умолчанию, но
// оставляем имя proxy для ясности — так же называется файл).
// Proxy отвечает только за "есть/нет сессии" и не делает запросов к
// profiles — ролевой гейтинг /admin/* живёт в app/(main)/admin/layout.tsx,
// чтобы не бить БД на каждый защищённый роут.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // auth.getUser() верифицирует токен на Auth-сервере (в отличие от
  // getSession(), которая просто читает cookie) — обязательно для
  // серверной проверки личности.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname + search);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute(pathname)) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');
    const target = isSafeRedirectTarget(redirectTo) ? redirectTo : '/map';
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  // Пропускаем PWA-статику (manifest, service worker, иконки) — она
  // публичная и не должна вообще проходить через auth-логику: иначе
  // регистрация SW и установка на главный экран сломаются на любом
  // сбое auth-инфраструктуры.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
