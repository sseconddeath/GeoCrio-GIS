import type { MetadataRoute } from 'next';

// Web App Manifest. Позволяет установить ГеоКрио ГИС на главный экран
// телефона (iOS/Android) и запускать как отдельное приложение — без
// адресной строки, во весь экран. Это критично в поле: геолог тыкает
// иконку, попадает сразу в карту.
//
// start_url: '/map' — при запуске из иконки открываем карту, не login.
// Если сессии нет, редирект на /login отработает proxy.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ГеоКрио ГИС',
    short_name: 'ГеоКрио',
    description:
      'Геоинформационная система для геокриологии: скважины, точки наблюдений, замеры мерзлоты в поле.',
    lang: 'ru',
    dir: 'ltr',
    start_url: '/map',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f5f5f5',
    theme_color: '#1a1f2e',
    categories: ['productivity', 'utilities', 'science'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
