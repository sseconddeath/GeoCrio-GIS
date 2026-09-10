import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ГеоКрио ГИС',
  description:
    'Геоинформационная система для геокриологии: скважины, точки наблюдений, замеры мерзлоты в поле.',
  applicationName: 'ГеоКрио ГИС',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ГеоКрио',
  },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // theme-color для браузера (Chrome/Safari address bar + overscroll
  // bounce). Ставим светлый, чтобы на iOS Safari при «резинке» вверх/
  // вниз не мелькала тёмная полоса под status bar. В PWA-standalone
  // режиме используется отдельный theme_color из manifest.ts, там
  // остаётся тёмный — сливается с нашим Header.
  themeColor: '#f9fafb',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans">
        <ToastProvider>
          <OfflineBanner />
          {children}
          <InstallPrompt />
          <ServiceWorkerRegistrar />
        </ToastProvider>
      </body>
    </html>
  );
}
