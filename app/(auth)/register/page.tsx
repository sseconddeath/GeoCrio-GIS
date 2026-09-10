import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export default function RegisterPage() {
  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Регистрация</h2>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-medium text-header hover:underline">
          Войти
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-gray-500">
        <Link href="/install" className="hover:underline">
          Установить приложение на телефон или компьютер →
        </Link>
      </p>
    </div>
  );
}
