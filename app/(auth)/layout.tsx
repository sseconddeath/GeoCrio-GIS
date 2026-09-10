import { Mountain } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh-safe flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-header shadow-lg shadow-header/20">
            <Mountain size={30} className="text-borehole" strokeWidth={2.25} aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-header">ГеоКрио ГИС</h1>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Геоинформационное обеспечение полевых практик и геокриологического полигона
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
