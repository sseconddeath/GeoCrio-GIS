import type { MetadataRoute } from 'next';

// Web App Manifest. Позволяет установить ГеоКрио ГИС на главный экран
// телефона (iOS/Android) и как приложение на десктоп (Chrome/Edge —
// кнопка «Установить» в адресной строке). Запускается в отдельном
// окне без адресной строки — критично в поле: геолог тыкает иконку,
// попадает сразу в карту.
//
// shortcuts — быстрые действия из иконки приложения (long-press на
// Android, right-click на десктопе). Как в WhatsApp «Новое сообщение»
// из ярлыка на рабочем столе.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ГеоКрио ГИС',
    short_name: 'ГеоКрио',
    description:
      'Геоинформационная система для геокриологии: скважины, точки наблюдений, замеры мерзлоты в поле.',
    lang: 'ru',
    dir: 'ltr',
    start_url: '/map',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    background_color: '#f5f5f5',
    theme_color: '#1a1f2e',
    categories: ['productivity', 'utilities', 'science'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Открыть карту',
        short_name: 'Карта',
        description: 'Активный участок на карте',
        url: '/map',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Мои уведомления',
        short_name: 'Правки',
        description: 'Входящие предложения по вашим объектам',
        url: '/inbox',
        icons: [{ src: '/icons/shortcut-inbox.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Аналитика участка',
        short_name: 'Сводка',
        description: 'Замеры, статус мерзлоты, гистограмма',
        url: '/analytics',
        icons: [{ src: '/icons/shortcut-borehole.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Список моих участков',
        short_name: 'Участки',
        url: '/polygons',
        icons: [{ src: '/icons/shortcut-point.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
