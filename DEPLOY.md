# Деплой ГеоКрио ГИС (Supabase + Vercel)

Пошаговая инструкция для первого развёртывания. Всё бесплатно
в пределах free-плана обоих сервисов; никаких карт не спрашивают.

Порядок такой:

1. Создать проект в Supabase (база + auth + storage).
2. Прогнать миграции.
3. Создать бакеты для фото.
4. Сгенерировать VAPID-ключи для push-уведомлений.
5. Задеплоить на Vercel и подключить env-переменные.

Первый деплой занимает 20–30 минут.

---

## 1. Supabase-проект

1. Зайти на [supabase.com](https://supabase.com) → **Start your project** →
   войти через GitHub.
2. **New project**:
   - **Name**: `geokrio` (или как хочешь).
   - **Database password**: нажми «Generate a password», **скопируй его в
     менеджер паролей** — он понадобится для прямого доступа к БД,
     восстановить нельзя.
   - **Region**: `Central EU (Frankfurt)` — ближайший к России, ~50 мс
     пинг.
   - **Pricing plan**: Free.
3. Подожди ~2 минуты, пока Supabase поднимет базу.

## 2. Прогон миграций

Открой **SQL Editor** (иконка `⚡` в левом меню). Прогони по одному
файлу за раз (в правильном порядке!):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_storage_setup.sql
supabase/migrations/004_multi_user_polygons.sql
supabase/migrations/005_object_history_rpc.sql
supabase/migrations/006_edit_proposals.sql
supabase/migrations/007_security_hardening.sql
supabase/migrations/008_photos_realtime.sql
supabase/migrations/009_push_subscriptions.sql
supabase/migrations/010_view_security_invoker.sql
supabase/migrations/011_spatial_ref_sys_rls.sql
supabase/migrations/012_polygon_boundary_geojson.sql
```

**Миграцию 003 пропускаем** — она создавала seed-полигон для разработки,
в боевой базе не нужен (пользователи заводят свои участки сами).

Каждый файл: открой на GitHub → «Copy raw file» → в Supabase SQL Editor
→ **New query** → вставить → **Run**. Ждать «Success. No rows returned».
Если хоть одна миграция ругнулась — не идти дальше, сначала разобраться.

Пути прогона можно посмотреть в **Table Editor** — должны появиться
таблицы `polygons`, `boreholes`, `observation_points`, `measurements`,
`photos`, `edit_proposals`, `push_subscriptions` и другие.

## 3. Storage-бакеты

Миграция 002 создаёт бакеты автоматически. Проверь: **Storage** в
левом меню, там должны быть `photos` (приватный), `thumbnails`,
`tiles`, `exports`. Если нет — миграция 002 не прошла, вернись к
предыдущему шагу.

## 4. Первый админ

По умолчанию все зарегистрированные пользователи получают роль
`researcher`. Хотя бы одного нужно повысить до `admin`, чтобы у него
был доступ к `/admin/*` (пользователи, аудит-лог).

1. Сначала зарегистрируй себя как обычного пользователя (это
   произойдёт после деплоя, шаг 6). Пока просто помни, что нужно
   вернуться сюда.
2. Когда зарегишься — в Supabase → **SQL Editor**:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = (
     SELECT id FROM auth.users WHERE email = 'твой@email.ru'
   );
   ```

## 5. VAPID-ключи для push-уведомлений

Один раз в терминале на любой машине:

```bash
npx web-push generate-vapid-keys
```

Вывод:
```
Public Key: BEl62iUYgUivxIkv69yViEuiBIa-...
Private Key: sSuwCvfN...
```

Сохрани оба — они попадут в env-переменные Vercel.

## 6. Vercel

1. Зайти на [vercel.com](https://vercel.com) → войти через GitHub.
2. **Add New → Project** → импортировать репозиторий `GeoCrio-GIS`.
3. Vercel автоматически определит Next.js. **Не жми Deploy сразу** —
   сначала раскрой **Environment Variables** и добавь:

   | Имя переменной                     | Откуда взять                                                    |
   |------------------------------------|-----------------------------------------------------------------|
   | `NEXT_PUBLIC_SUPABASE_URL`         | Supabase → Project Settings → API → **Project URL**             |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase → Project Settings → API → **anon public**             |
   | `SUPABASE_SERVICE_ROLE_KEY`        | Supabase → Project Settings → API → **service_role** (секретный!) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`     | Public Key из шага 5                                            |
   | `VAPID_PRIVATE_KEY`                | Private Key из шага 5                                           |
   | `VAPID_SUBJECT`                    | `mailto:твой@email.ru`                                          |

4. **Deploy**. Через ~2 минуты в консоли появится URL вида
   `geokrio-abc123.vercel.app` — это уже рабочее приложение.

## 7. Supabase знает про наш домен

Чтобы OAuth / email-письма подтверждения корректно возвращали
пользователя на наш домен:

1. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://<твой-vercel-домен>.vercel.app`
   - **Redirect URLs**: `https://<твой-vercel-домен>.vercel.app/**`

## 8. Собственный домен (опционально)

Vercel предлагает бесплатный `.vercel.app` — этого достаточно.
Если хочется своё имя типа `geokrio.ru`:

1. Купить домен (reg.ru / nic.ru — ~200 ₽/год).
2. В Vercel → **Settings → Domains** → добавить домен, Vercel скажет
   какие DNS-записи прописать у регистратора.
3. HTTPS Vercel настроит сам через Let's Encrypt за ~10 минут.
4. **Обновить в Supabase Site URL и Redirect URLs** на новый домен.

---

## Проверка после деплоя

Открываем URL Vercel и пробуем:

- [ ] Регистрация → приходит письмо → подтверждение → вход.
- [ ] `/polygons/new` → нарисовать полигон на карте → сохранить.
- [ ] Клик по карте → добавить скважину → сохранить.
- [ ] Профиль скважины → добавить замер → появляется на графике T(z).
- [ ] Фото → выбрать/снять → загрузка + thumbnail.
- [ ] Экспорт → скачать CSV/GeoJSON.
- [ ] С мобильного Chrome: «Установить приложение» → иконка на
  главном экране, открывается во весь экран.
- [ ] Push: `/inbox` → «Включить уведомления» → браузер спрашивает
  разрешение → «Разрешить». Дальше нужно чтобы кто-то (другой аккаунт)
  подал предложение правки твоей скважины — должен прийти пуш.
- [ ] Первый админ (см. шаг 4) — доступ к `/admin/users` и `/admin/audit`.

---

## Обновления кода

Vercel автоматически передеплоит приложение при каждом push в ветку
`main` (можно поменять на другую в **Settings → Git**). Никаких
ручных действий — commit + push, через ~2 минуты обновление в проде.

Миграции БД **не применяются автоматически**. Новые SQL-файлы из
`supabase/migrations/*` нужно каждый раз прогонять руками через
Supabase SQL Editor. Или (когда захочешь) — поставить Supabase CLI и
делать `supabase db push` из терминала.

## Затраты

- **Supabase Free**: 500 МБ база / 1 ГБ файлов / 50 000 MAU. Хватит
  на дипломную работу и первые сотни пользователей.
- **Vercel Hobby**: неограниченные развёртывания, 100 ГБ трафика в
  месяц. Хватит.
- **Домен** (опционально): 200 ₽/год.

При росте — Supabase Pro стоит $25/мес (8 ГБ базы, 100 ГБ файлов),
Vercel Pro — $20/мес (не нужен пока пользователей мало).
