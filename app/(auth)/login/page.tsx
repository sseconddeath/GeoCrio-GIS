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
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Вход</h2>
      <LoginForm redirectTo={redirectTo} />
      <p className="mt-6 text-center text-sm text-gray-600">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-medium text-header hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
