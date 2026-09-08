interface StagePlaceholderProps {
  title: string;
  description: string;
  stage: number;
}

// Единый вид для ещё не реализованных разделов — читается как "запланировано",
// а не как сломанная страница.
export function StagePlaceholder({ title, description, stage }: StagePlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
        <span className="inline-block rounded-full bg-header/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-header">
          Этап {stage}
        </span>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
