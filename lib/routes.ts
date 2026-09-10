// Чистые функции маршрутизации/гейтинга. Без импортов Next.js/Supabase —
// юнит-тестируются изолированно (см. lib/routes.test.ts) и переиспользуются
// и в middleware.ts (Edge Runtime), и в серверных layout'ах.

// Все пути внутри защищённой группы app/(main) — доступны только с сессией.
export const PROTECTED_PREFIXES = [
  '/map',
  '/data',
  '/analytics',
  '/export',
  '/admin',
  '/polygons',
  '/boreholes',
  '/observation-points',
  '/trash',
] as const;

// Страницы аутентификации — залогиненного пользователя с них нужно увести.
export const AUTH_PATHS = ['/login', '/register'] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthRoute(pathname: string): boolean {
  return (AUTH_PATHS as readonly string[]).includes(pathname);
}

// Защита от open redirect: значение redirectTo из query-параметра допустимо,
// только если это относительный путь внутри приложения — один ведущий слэш,
// не протокол-относительный ("//evil.com") и без двоеточия (блокирует
// "javascript:", "http://evil.com" и т.п.).
export function isSafeRedirectTarget(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes(':')) return false;
  return true;
}
