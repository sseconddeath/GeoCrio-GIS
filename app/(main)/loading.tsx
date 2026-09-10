// Общий loading-скелетон для всех защищённых страниц. Next.js
// показывает его МГНОВЕННО при клике по ссылке (пока server component
// делает await'ы к Supabase). Без loading.tsx пользователь видит
// «серый экран» на 1-2 секунды и думает, что зависло.
export default function MainLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-8">
      <div className="h-6 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 h-4 w-1/2 rounded bg-gray-200" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-lg bg-gray-200" />
        <div className="h-24 rounded-lg bg-gray-200" />
        <div className="h-24 rounded-lg bg-gray-200" />
      </div>
      <div className="mt-6 h-64 rounded-lg bg-gray-200" />
    </div>
  );
}
