import Link from 'next/link';

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Экспорт данных</h1>
      <p className="mt-2 text-sm text-gray-600">
        Данные скачиваются отдельно по каждому участку — на странице участка
        есть кнопки «Скачать CSV» и «Скачать GeoJSON». Так удобно и не
        пересекается с чужими работами.
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-sm font-medium text-gray-900">Форматы</div>
        <ul className="mt-2 space-y-2 text-sm text-gray-700">
          <li>
            <strong>CSV</strong> — таблица с кодом, типом, параметрами и датой; открывается в
            Excel (кодировка UTF-8 с BOM).
          </li>
          <li>
            <strong>GeoJSON</strong> — полная геометрия объектов; открывается в QGIS,
            ArcGIS, Google Earth Pro и других ГИС.
          </li>
        </ul>
      </div>
      <div className="mt-6">
        <Link
          href="/polygons"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-header px-5 text-sm font-medium text-white hover:bg-header/90"
        >
          К списку участков
        </Link>
      </div>
    </div>
  );
}
