'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { parseCsv } from '@/lib/csv';
import {
  mapBoreholesFromCsv,
  mapObservationPointsFromCsv,
  type BoreholeCsvRow,
  type ObservationPointCsvRow,
} from '@/lib/csv-mapping';
import {
  bulkImportBoreholesAction,
  bulkImportObservationPointsAction,
} from '@/app/(main)/polygons/actions';

interface CsvImportFormProps {
  polygonId: string;
}

type Kind = 'boreholes' | 'observation_points';

// Форма массового импорта из CSV. Полный флоу:
//  1) Выбирается вид объекта (скважины или точки).
//  2) Пользователь либо вставляет CSV в textarea, либо загружает файл.
//  3) На каждое изменение — парсим и валидируем, показываем сводку:
//     сколько распознано, сколько ошибок и первые 5 ошибок с номерами
//     строк. Кнопка «Импортировать N объектов» активна, только если
//     ошибок нет и распознана хотя бы одна строка.
//  4) Server Action делает один batch INSERT (RLS + PostGIS-триггер
//     сами проверят права и границы). Возврат — тост и редирект.
export function CsvImportForm({ polygonId }: CsvImportFormProps) {
  const [kind, setKind] = useState<Kind>('boreholes');
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  const parsed = useMemo(() => {
    if (text.trim() === '') return null;
    const rawRows = parseCsv(text);
    if (kind === 'boreholes') return { kind: 'boreholes' as const, ...mapBoreholesFromCsv(rawRows) };
    return { kind: 'observation_points' as const, ...mapObservationPointsFromCsv(rawRows) };
  }, [text, kind]);

  const readyCount = parsed?.rows.length ?? 0;
  const errorCount = parsed?.errors.length ?? 0;
  const canImport = parsed !== null && readyCount > 0 && errorCount === 0;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
    } catch {
      showToast({ kind: 'error', message: 'Не удалось прочитать файл' });
    } finally {
      event.target.value = '';
    }
  };

  const runImport = () => {
    if (!parsed || !canImport) return;
    startTransition(async () => {
      const result =
        parsed.kind === 'boreholes'
          ? await bulkImportBoreholesAction(polygonId, parsed.rows as BoreholeCsvRow[])
          : await bulkImportObservationPointsAction(
              polygonId,
              parsed.rows as ObservationPointCsvRow[],
            );
      if (result.imported > 0) {
        showToast({
          kind: 'success',
          message: `Импортировано ${result.imported} ${
            parsed.kind === 'boreholes' ? 'скважин' : 'точек'
          }.`,
        });
        setText('');
        router.push(`/polygons/${polygonId}`);
        router.refresh();
      } else {
        showToast({
          kind: 'error',
          message: result.errors?.[0] ?? 'Не удалось импортировать',
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="boreholes"
            checked={kind === 'boreholes'}
            onChange={() => setKind('boreholes')}
          />
          Скважины
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="observation_points"
            checked={kind === 'observation_points'}
            onChange={() => setKind('observation_points')}
          />
          Точки наблюдений
        </label>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <div className="mb-2 font-medium text-gray-800">Формат заголовков (первая строка):</div>
        {kind === 'boreholes' ? (
          <code className="block font-mono text-[11px]">
            код;широта;долгота;глубина;тип грунта;описание
            <br />
            Скв-01;57.20123;65.60000;4.5;суглинок;Керн 3-4 м
          </code>
        ) : (
          <code className="block font-mono text-[11px]">
            код;широта;долгота;тип;описание
            <br />
            Тчк-01;57.20500;65.60800;геокриологическая;Мерзлотомер
          </code>
        )}
        <p className="mt-2">
          Разделитель: ; или , (авто). Кодировка UTF-8 (Excel: «Сохранить как → CSV UTF-8»).
          Обязательные колонки — код, широта, долгота
          {kind === 'observation_points' ? ' и тип' : ''}. Точки вне границы участка (+500 м)
          отклоняются на сервере.
        </p>
      </div>

      <div>
        <label htmlFor="csv-input" className="mb-1 block text-sm font-medium text-gray-700">
          Вставьте содержимое CSV
        </label>
        <textarea
          id="csv-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-header/50"
          placeholder="…или загрузите файл ниже"
        />
      </div>

      <label className="inline-flex min-h-[36px] w-fit cursor-pointer items-center rounded-md border border-header/40 bg-white px-3 text-xs font-medium text-header hover:bg-header/5">
        Загрузить .csv
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
      </label>

      {parsed !== null ? (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-gray-700">
              Готово к импорту: <strong>{readyCount}</strong>
            </span>
            {errorCount > 0 ? (
              <span className="text-red-700">
                Ошибок: <strong>{errorCount}</strong>
              </span>
            ) : null}
          </div>
          {errorCount > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-red-700">
              {parsed.errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  строка {e.line}: {e.message}
                </li>
              ))}
              {errorCount > 5 ? (
                <li className="text-gray-500">…и ещё {errorCount - 5}. Исправьте и попробуйте снова.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={runImport} disabled={!canImport || pending}>
          {pending ? 'Импортирую…' : readyCount > 0 ? `Импортировать ${readyCount}` : 'Импортировать'}
        </Button>
      </div>
    </div>
  );
}
