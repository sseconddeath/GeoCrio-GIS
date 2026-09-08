import { z } from 'zod';

// Минимальная длина пароля здесь (8) может быть строже, чем настройка
// Supabase Auth в конкретном проекте (по умолчанию 6). Сверить с Dashboard →
// Authentication → Policies при первом деплое — если сервер разрешает
// более короткие пароли, это безобидно (клиент просто строже), но если
// потребуется единообразие, поднять/опустить здесь.
const PASSWORD_MIN_LENGTH = 8;

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Введите имя и фамилию'),
    email: z.string().email('Введите корректный email'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
