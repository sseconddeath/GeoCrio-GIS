/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    // Next 16: не бросает ошибку при офлайн-навигации / RSC-фетче / Server
    // Action — держит запрос pending и авто-повторяет, когда связь вернётся.
    // useOffline() из next/offline даёт UI-состояние.
    useOffline: true,
  },
  async headers() {
    return [
      {
        // Service worker всегда свежий, иначе клиент застрянет на старой
        // версии SW, а новая появится только после ручного «обновить».
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
