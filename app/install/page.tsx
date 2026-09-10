import type { Metadata } from 'next';
import Link from 'next/link';

// Публичная (без auth) landing-страница с инструкцией по установке
// приложения на всех платформах. Даёт пользователю одну ссылку
// «gecrio.ru/install» и на месте объясняет, как поставить.
//
// Технически ГеоКрио — Progressive Web App. Она умеет ставиться
// напрямую из браузера (Android WebAPK, iOS «На экран Домой»,
// Chrome/Edge Desktop «Установить приложение»). Для настоящих
// .apk/.msix/.exe пакетов — pwabuilder.com читает наш manifest и
// упаковывает без переписывания кода.

export const metadata: Metadata = {
  title: 'Установить ГеоКрио ГИС',
  description:
    'Инструкция по установке ГеоКрио ГИС на телефон (Android/iOS) и компьютер (Windows/macOS/Linux).',
};

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-xs uppercase tracking-wide text-gray-500">Установить</div>
      <h1 className="mt-1 text-3xl font-semibold text-gray-900">ГеоКрио ГИС</h1>
      <p className="mt-3 text-sm text-gray-600">
        Приложение открывается прямо в браузере, но для полевой работы удобнее поставить его как
        обычную программу — иконка на рабочем столе, полноэкранный режим без адресной строки,
        работа с уже загруженной картой без интернета.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlatformCard
          title="Android"
          steps={[
            'Откройте эту страницу в Chrome (или другом Chromium-браузере).',
            'В адресной строке или меню — «Установить приложение» / «Добавить на главный экран».',
            'Иконка «ГеоКрио» появится рядом с другими приложениями. Открывается во весь экран.',
          ]}
          note="Работает также офлайн (SW кэширует карту и статику). Push-уведомления о новых предложениях правок приходят даже когда приложение закрыто."
        />
        <PlatformCard
          title="iOS (iPhone / iPad)"
          steps={[
            'Откройте эту страницу в Safari (важно: Chrome для iOS не поддерживает установку).',
            'Нажмите «Поделиться» (значок квадрата со стрелкой вверх).',
            'В меню — «На экран Домой» → «Добавить».',
          ]}
          note="Push-уведомления работают только когда приложение запущено с домашнего экрана (это ограничение iOS)."
        />
        <PlatformCard
          title="Windows / macOS / Linux"
          steps={[
            'Откройте эту страницу в Chrome, Edge или Brave.',
            'В правой части адресной строки появится значок «Установить» (или пункт «Установить ГеоКрио» в меню ⋮).',
            'Программа откроется в своём окне без адресной строки — можно закрепить в панели задач / Dock.',
          ]}
          note="Обновления загружаются автоматически как в веб-версии — переустанавливать ничего не нужно."
        />
        <PlatformCard
          title="Настоящий .exe / .apk / .msix"
          steps={[
            'Скопируйте адрес приложения (например, geokrio.example.com).',
            'Откройте pwabuilder.com и вставьте адрес.',
            'PWABuilder прочитает манифест и соберёт установщик под нужную платформу: .msix для Microsoft Store, .apk / .aab для Google Play, iOS-проект для Xcode.',
          ]}
          note="Сборка занимает минуту, ничего переписывать не нужно. Обновления пойдут через веб — как для обычного PWA."
          linkHref="https://www.pwabuilder.com"
          linkLabel="Открыть PWABuilder →"
        />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Что работает офлайн</h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          <li>• Плитки карты OSM для уже посещённых областей (кэш ~800 плиток).</li>
          <li>
            • Создание скважин, точек, замеров и фото — попадают в локальную очередь и уходят
            на сервер, как только связь вернётся.
          </li>
          <li>• Индикатор синхронизации в шапке показывает, сколько операций ждут отправки.</li>
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-header/40 bg-white px-5 text-sm font-medium text-header hover:bg-header/5"
        >
          Зарегистрироваться
        </Link>
      </div>
    </div>
  );
}

function PlatformCard({
  title,
  steps,
  note,
  linkHref,
  linkLabel,
}: {
  title: string;
  steps: string[];
  note?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <ol className="mt-3 space-y-1.5 text-sm text-gray-700">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-0.5 shrink-0 font-mono text-xs text-gray-400">
              {i + 1}.
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-3 text-xs text-gray-500">{note}</p> : null}
      {linkHref ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-header hover:underline"
        >
          {linkLabel ?? linkHref}
        </a>
      ) : null}
    </div>
  );
}
