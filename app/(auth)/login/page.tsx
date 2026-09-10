import { Download } from 'lucide-react';
import Link from 'next/link';
import { LoginForm } from './LoginForm';

// Next.js 16: searchParams передаётся как Promise (Promise-based request API с Next 15+).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Вход</h2>
        <p className="mt-1 text-sm text-gray-500">Войдите, чтобы продолжить полевые наблюдения.</p>
      </div>
      <LoginForm redirectTo={redirectTo} />
      <div className="mt-6 border-t border-gray-100 pt-5">
        <p className="text-center text-sm text-gray-600">
          Нет аккаунта?{' '}
          <Link href="/register" className="font-medium text-header hover:underline">
            Зарегистрироваться
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-500">
          <Link href="/install" className="inline-flex items-center gap-1.5 hover:underline">
            <Download size={12} aria-hidden />
            Установить приложение на телефон или ПК
          </Link>
        </p>
      </div>
    </div>
  );
}
