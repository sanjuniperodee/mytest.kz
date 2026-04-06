import { Alert, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UNIVERSITY_THRESHOLDS_DEMO, type ThresholdRow } from '../data/universityThresholdsDemo';

const columns: ColumnsType<ThresholdRow> = [
  { title: 'Вуз', dataIndex: 'university', key: 'university', width: 200 },
  { title: 'Направление (пример)', dataIndex: 'specialty', key: 'specialty', width: 220 },
  { title: '2022', dataIndex: 'y2022', key: 'y2022', width: 88, align: 'right' },
  { title: '2023', dataIndex: 'y2023', key: 'y2023', width: 88, align: 'right' },
  { title: '2024', dataIndex: 'y2024', key: 'y2024', width: 88, align: 'right' },
  { title: '2025', dataIndex: 'y2025', key: 'y2025', width: 88, align: 'right' },
  { title: '2026', dataIndex: 'y2026', key: 'y2026', width: 88, align: 'right' },
];

export function UniversityThresholdsPage() {
  return (
    <div>
      <h2 className="admin-page-title">Пороговые баллы в вузы (последние 5 лет)</h2>
      <p className="admin-page-lead">
        Справочная таблица для ориентира по динамике порогов. Значения ниже — демонстрационные; для
        принятия решений используйте официальные конкурсные списки и порталы приёма.
      </p>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 20 }}
        message="Иллюстративные данные"
        description="Строки не привязаны к живому API. При появлении надёжного источника (CSV/API) таблицу можно заменить на загрузку из бэкенда."
      />

      <Table<ThresholdRow>
        rowKey={(r) => `${r.university}-${r.specialty}`}
        columns={columns}
        dataSource={UNIVERSITY_THRESHOLDS_DEMO}
        pagination={false}
        size="middle"
      />

      <Typography.Paragraph type="secondary" style={{ marginTop: 20, marginBottom: 0 }}>
        Колонки годов отражают условный минимальный конкурсный балл для примера; реальные пороги зависят
        от гранта/контракта, региона и квот.
      </Typography.Paragraph>
    </div>
  );
}
