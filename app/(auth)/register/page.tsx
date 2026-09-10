import { Download } from 'lucide-react';
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Регистрация</h2>
        <p className="mt-1 text-sm text-gray-500">
          Создайте аккаунт, чтобы завести свой полигон и вести полевые наблюдения.
        </p>
      </div>
      <RegisterForm />
      <div className="mt-6 border-t border-gray-100 pt-5">
        <p className="text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium text-header hover:underline">
            Войти
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
