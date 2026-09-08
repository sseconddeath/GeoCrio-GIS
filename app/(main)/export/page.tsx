import { StagePlaceholder } from '@/components/ui/StagePlaceholder';

export default function ExportPage() {
  return (
    <StagePlaceholder
      stage={5}
      title="Экспорт"
      description="Выгрузка данных полигона в GeoJSON, CSV и Shapefile появится на Этапе 5."
    />
  );
}
