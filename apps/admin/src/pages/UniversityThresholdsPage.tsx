import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, Space, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  fetchAdmissionCutoffs,
  fetchAdmissionCycles,
  fetchAdmissionUniversities,
} from '../api/admission';

type Row = {
  key: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  minScore: number | null;
};

export function UniversityThresholdsPage() {
  const [cycleSlug, setCycleSlug] = useState('');
  const [universityCode, setUniversityCode] = useState<number | null>(null);
  const [quotaType, setQuotaType] = useState<'GRANT' | 'RURAL'>('GRANT');

  const cyclesQ = useQuery({ queryKey: ['admission', 'cycles'], queryFn: fetchAdmissionCycles });
  const unisQ = useQuery({ queryKey: ['admission', 'universities'], queryFn: fetchAdmissionUniversities });

  useEffect(() => {
    if (!cycleSlug && cyclesQ.data?.length) {
      const sorted = [...cyclesQ.data].sort((a, b) => b.sortOrder - a.sortOrder);
      setCycleSlug(sorted[0].slug);
    }
  }, [cycleSlug, cyclesQ.data]);

  const cutoffsQ = useQuery({
    queryKey: ['admission', 'cutoffs', cycleSlug, universityCode, quotaType],
    queryFn: () =>
      fetchAdmissionCutoffs({
        cycleSlug,
        universityCode: universityCode!,
        quotaType,
      }),
    enabled: Boolean(cycleSlug && universityCode != null),
  });

  const dataSource: Row[] = useMemo(() => {
    const rows = cutoffsQ.data;
    if (!rows?.length) return [];
    const byProg = new Map<string, Row>();
    for (const c of rows) {
      if (c.quotaType !== quotaType) continue;
      const key = c.programId;
      if (!byProg.has(key)) {
        byProg.set(key, {
          key,
          programCode: c.programCode,
          programName: c.programName,
          profileSubjects: c.profileSubjects,
          minScore: c.minScore,
        });
      }
    }
    return [...byProg.values()].sort((a, b) => a.programCode.localeCompare(b.programCode));
  }, [cutoffsQ.data, quotaType]);

  const columns: ColumnsType<Row> = [
    { title: 'Код', dataIndex: 'programCode', key: 'programCode', width: 88 },
    { title: 'Программа', dataIndex: 'programName', key: 'programName', ellipsis: true },
    { title: 'Профильные предметы', dataIndex: 'profileSubjects', key: 'profileSubjects', ellipsis: true },
    {
      title: quotaType === 'GRANT' ? 'Грант (мин. балл)' : 'Сельская квота (мин. балл)',
      dataIndex: 'minScore',
      key: 'minScore',
      width: 120,
      align: 'right',
      render: (v: number | null) => (v == null ? '—' : v),
    },
  ];

  return (
    <div>
      <p className="admin-hint" style={{ marginTop: 0 }}>
        Справочник из API. Для зачисления ориентируйтесь на официальные источники приёма.
      </p>

      {cyclesQ.isLoading || unisQ.isLoading ? (
        <Spin />
      ) : cyclesQ.isError ? (
        <Typography.Text type="danger">Не удалось загрузить циклы приёма.</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }} size="middle">
          <Space wrap>
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Цикл
              </Typography.Text>
              <Select
                style={{ minWidth: 160 }}
                value={cycleSlug}
                onChange={setCycleSlug}
                options={cyclesQ.data?.map((c) => ({ value: c.slug, label: c.slug }))}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Вуз
              </Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 320 }}
                placeholder="Вуз"
                value={universityCode ?? undefined}
                onChange={(v) => setUniversityCode(v)}
                options={unisQ.data?.map((u) => ({
                  value: u.code,
                  label: `${u.shortName || u.name} (${u.code})`,
                }))}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Квота
              </Typography.Text>
              <Select
                style={{ minWidth: 200 }}
                value={quotaType}
                onChange={(v) => setQuotaType(v)}
                options={[
                  { value: 'GRANT', label: 'Грант' },
                  { value: 'RURAL', label: 'Сельская квота' },
                ]}
              />
            </div>
          </Space>
        </Space>
      )}

      <Table<Row>
        rowKey={(r) => r.key}
        columns={columns}
        dataSource={dataSource}
        loading={cutoffsQ.isFetching}
        pagination={{ pageSize: 25 }}
        size="middle"
      />

      <p className="admin-hint" style={{ marginBottom: 0 }}>
        «—» — нет данных по программе в этом вузе.
      </p>
    </div>
  );
}
