import type { AuthError } from '@supabase/supabase-js';

// Переводит структурированные error.code от Supabase Auth в понятные
// русскоязычные сообщения. Список кодов — из @supabase/auth-js.
export function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Неверный email или пароль';
    case 'email_not_confirmed':
      return 'Email не подтверждён — проверьте почту';
    case 'email_exists':
    case 'user_already_exists':
      return 'Пользователь с таким email уже зарегистрирован';
    case 'weak_password':
      return 'Пароль слишком простой, выберите более надёжный';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Слишком много попыток, попробуйте позже';
    case 'user_not_found':
      return 'Пользователь не найден';
    default:
      return 'Не удалось выполнить операцию, попробуйте ещё раз';
  }
}
