// 240px, десктоп (раздел 12 ТЗ). Контент — панель слоёв и легенда — появится
// на Этапе 2 вместе с картой; сейчас каркас задаёт только размер и место.
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white p-4 lg:block">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Слои и легенда</p>
      <p className="mt-2 text-sm text-gray-500">Появится на Этапе 2 вместе с картой.</p>
    </aside>
  );
}
