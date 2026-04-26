import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Select, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  fetchAdmissionCutoffs,
  fetchAdmissionCycles,
  fetchAdmissionUniversities,
} from '../api/admission';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigGroup, HigTableCard } from '../components/HigBlocks';

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
    <AdminPageShell>
      <div className="pg-ex__hero" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Пороги вузов</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'rgba(60,60,67,0.85)', maxWidth: '38rem' }}>
          Минимальные проходные баллы по программам из выгрузки приёма. Выберите цикл, вуз и тип квоты — таблица
          пересчитается.
        </p>
      </div>
      {cyclesQ.isLoading || unisQ.isLoading ? (
        <div className="admin-boot" style={{ minHeight: 200 }}>
          <Spin />
        </div>
      ) : cyclesQ.isError ? (
        <Typography.Text type="danger">Не удалось загрузить циклы приёма.</Typography.Text>
      ) : (
        <HigGroup label="Справочник" description="Цикл, вуз и тип квоты определяют набор порогов в таблице.">
        <Card className="hig-filter-card" size="small">
          <div className="pg-th__filters">
            <div className="pg-th__field">
              <Typography.Text type="secondary">Цикл приёма</Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={cycleSlug}
                onChange={setCycleSlug}
                options={cyclesQ.data?.map((c) => ({ value: c.slug, label: c.slug }))}
              />
            </div>
            <div className="pg-th__field">
              <Typography.Text type="secondary">Вуз</Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder="Вуз"
                value={universityCode ?? undefined}
                onChange={(v) => setUniversityCode(v)}
                options={unisQ.data?.map((u) => ({
                  value: u.code,
                  label: `${u.shortName || u.name} (${u.code})`,
                }))}
              />
            </div>
            <div className="pg-th__field">
              <Typography.Text type="secondary">Квота</Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={quotaType}
                onChange={(v) => setQuotaType(v)}
                options={[
                  { value: 'GRANT', label: 'Грант' },
                  { value: 'RURAL', label: 'Сельская' },
                ]}
              />
            </div>
          </div>
        </Card>
        </HigGroup>
      )}

      <HigGroup label="Программы и пороги">
        <HigTableCard>
          <Table<Row>
            rowKey={(r) => r.key}
            columns={columns}
            dataSource={dataSource}
            loading={cutoffsQ.isFetching}
            pagination={{ pageSize: 25 }}
            size="small"
            scroll={{ x: 800 }}
          />
        </HigTableCard>
      </HigGroup>
    </AdminPageShell>
  );
}
