export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh-safe flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-header">ГеоКрио ГИС</h1>
          <p className="mt-1 text-sm text-gray-500">
            Геоинформационное обеспечение полевых практик и геокриологического полигона
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
