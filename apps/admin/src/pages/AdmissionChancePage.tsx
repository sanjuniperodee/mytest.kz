import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, InputNumber, Row, Select, Slider, Space, Spin, Tag, Typography } from 'antd';
import {
  ENT_MAX,
  ENT_THRESHOLD_2026,
  ENT_TOTAL_MAX,
  grantTierHint,
  passesThresholds,
  totalEntScore,
  type EntScores,
} from '@bilimland/shared';
import {
  fetchAdmissionCompare,
  fetchAdmissionCutoffs,
  fetchAdmissionCycles,
  fetchAdmissionUniversities,
} from '../api/admission';

const tierRu: Record<ReturnType<typeof grantTierHint>, { label: string; color: string }> = {
  Blocked: { label: 'Не проходите пороги', color: 'red' },
  Grow: { label: 'Ниже типичного диапазона гранта', color: 'default' },
  Base: { label: 'Базовый ориентир', color: 'blue' },
  National: { label: 'Сильный профиль', color: 'geekblue' },
  Strong: { label: 'Высокий потенциал', color: 'green' },
};

function EntBlock({
  label,
  value,
  onChange,
  max,
  threshold,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  threshold: number;
}) {
  return (
    <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '12px 16px' } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Typography.Text strong>{label}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          порог {threshold} / макс {max}
        </Typography.Text>
      </div>
      <Row gutter={12} align="middle">
        <Col flex="auto">
          <Slider min={0} max={max} value={value} onChange={onChange} tooltip={{ formatter: (v) => `${v}` }} />
        </Col>
        <Col>
          <InputNumber min={0} max={max} value={value} onChange={(v) => onChange(Number(v ?? 0))} />
        </Col>
      </Row>
    </Card>
  );
}

const initial: EntScores = {
  mathLit: 5,
  readingLit: 5,
  history: 10,
  profile1: 25,
  profile2: 25,
};

export function AdmissionChancePage() {
  const [scores, setScores] = useState<EntScores>(initial);
  const [cycleSlug, setCycleSlug] = useState('');
  const [universityCode, setUniversityCode] = useState<number | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [quotaType, setQuotaType] = useState<'GRANT' | 'RURAL'>('GRANT');

  const total = useMemo(() => totalEntScore(scores), [scores]);
  const passed = useMemo(() => passesThresholds(scores), [scores]);
  const tier = useMemo(() => grantTierHint(total, passed), [total, passed]);
  const tierInfo = tierRu[tier];

  const set =
    (key: keyof EntScores) =>
    (v: number) =>
      setScores((s) => ({ ...s, [key]: v }));

  const cyclesQ = useQuery({ queryKey: ['admission', 'cycles'], queryFn: fetchAdmissionCycles });
  const unisQ = useQuery({ queryKey: ['admission', 'universities'], queryFn: fetchAdmissionUniversities });

  useEffect(() => {
    if (!cycleSlug && cyclesQ.data?.length) {
      const sorted = [...cyclesQ.data].sort((a, b) => b.sortOrder - a.sortOrder);
      setCycleSlug(sorted[0].slug);
    }
  }, [cycleSlug, cyclesQ.data]);

  const cutoffsQ = useQuery({
    queryKey: ['admission', 'cutoffs', cycleSlug, universityCode],
    queryFn: () =>
      fetchAdmissionCutoffs({
        cycleSlug,
        universityCode: universityCode!,
      }),
    enabled: Boolean(cycleSlug && universityCode != null),
  });

  const programOptions = useMemo(() => {
    const rows = cutoffsQ.data;
    if (!rows?.length) return [];
    const m = new Map<string, string>();
    for (const c of rows) {
      if (c.quotaType !== quotaType) continue;
      m.set(c.programId, `${c.programCode} — ${c.programName}`);
    }
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [cutoffsQ.data, quotaType]);

  useEffect(() => {
    if (programId && !programOptions.some((p) => p.value === programId)) {
      setProgramId(null);
    }
  }, [programOptions, programId]);

  const compareQ = useQuery({
    queryKey: [
      'admission',
      'compare',
      cycleSlug,
      universityCode,
      programId,
      quotaType,
      scores.mathLit,
      scores.readingLit,
      scores.history,
      scores.profile1,
      scores.profile2,
    ],
    queryFn: () =>
      fetchAdmissionCompare({
        cycleSlug,
        universityCode: universityCode!,
        programId: programId!,
        quotaType,
        mathLit: scores.mathLit,
        readingLit: scores.readingLit,
        history: scores.history,
        profile1: scores.profile1,
        profile2: scores.profile2,
      }),
    enabled: Boolean(cycleSlug && universityCode != null && programId),
  });

  return (
    <div>
      <h2 className="admin-page-title">Шанс поступления (модель ҰБТ 2026)</h2>
      <p className="admin-page-lead">
        Интерактивная оценка по порогам и суммарному баллу (максимум {ENT_TOTAL_MAX}). Ниже — сравнение с
        прошлыми конкурсными баллами из загруженной аналитики. Категории — ориентир, не юридическая гарантия
        зачисления.
      </p>

      {cyclesQ.isLoading || unisQ.isLoading ? (
        <Spin />
      ) : cyclesQ.isError ? (
        <Typography.Text type="danger">Не удалось загрузить справочник приёма (нужен API и сид данных).</Typography.Text>
      ) : (
        <Card size="small" style={{ marginBottom: 20 }} title="Справочник гранта">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Typography.Text type="secondary">Цикл приёма</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                value={cycleSlug || undefined}
                options={cyclesQ.data?.map((c) => ({ value: c.slug, label: c.slug }))}
                onChange={(v) => setCycleSlug(v)}
              />
            </div>
            <div>
              <Typography.Text type="secondary">Вуз</Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Выберите вуз"
                value={universityCode ?? undefined}
                onChange={(v) => {
                  setUniversityCode(v);
                  setProgramId(null);
                }}
                options={unisQ.data?.map((u) => ({
                  value: u.code,
                  label: `${u.shortName || u.name} (${u.code})`,
                }))}
              />
            </div>
            <div>
              <Typography.Text type="secondary">Квота</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                value={quotaType}
                onChange={(v) => setQuotaType(v)}
                options={[
                  { value: 'GRANT', label: 'Грант' },
                  { value: 'RURAL', label: 'Сельская квота' },
                ]}
              />
            </div>
            <div>
              <Typography.Text type="secondary">Программа</Typography.Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
                placeholder={universityCode == null ? 'Сначала выберите вуз' : 'Выберите программу'}
                value={programId ?? undefined}
                onChange={(v) => setProgramId(v)}
                disabled={universityCode == null || cutoffsQ.isLoading}
                options={programOptions}
              />
            </div>
          </Space>
        </Card>
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <EntBlock
            label="Математическая грамотность"
            value={scores.mathLit}
            onChange={set('mathLit')}
            max={ENT_MAX.mathLit}
            threshold={ENT_THRESHOLD_2026.mathLit}
          />
          <EntBlock
            label="Грамотность чтения"
            value={scores.readingLit}
            onChange={set('readingLit')}
            max={ENT_MAX.readingLit}
            threshold={ENT_THRESHOLD_2026.readingLit}
          />
          <EntBlock
            label="История Казахстана"
            value={scores.history}
            onChange={set('history')}
            max={ENT_MAX.history}
            threshold={ENT_THRESHOLD_2026.history}
          />
          <EntBlock
            label="Профильный предмет 1"
            value={scores.profile1}
            onChange={set('profile1')}
            max={ENT_MAX.profile1}
            threshold={ENT_THRESHOLD_2026.profile1}
          />
          <EntBlock
            label="Профильный предмет 2"
            value={scores.profile2}
            onChange={set('profile2')}
            max={ENT_MAX.profile2}
            threshold={ENT_THRESHOLD_2026.profile2}
          />
        </Col>
        <Col xs={24} lg={10}>
          <Card className="admin-stat-card" title="Итог">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Typography.Text type="secondary">Суммарный балл</Typography.Text>
                <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>
                  {total.toFixed(0)}
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>
                    {' '}
                    / {ENT_TOTAL_MAX}
                  </span>
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Пороги ҰБТ</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color={passed ? 'success' : 'error'}>{passed ? 'Выполнены' : 'Не выполнены'}</Tag>
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Ориентир по уровню</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color={tierInfo.color}>{tierInfo.label}</Tag>
                </div>
              </div>
              {compareQ.data && (
                <div>
                  <Typography.Text type="secondary">Прошлый конкурсный порог (выборка)</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    {compareQ.data.hasCutoff && compareQ.data.cutoff != null ? (
                      <Typography.Paragraph style={{ marginBottom: 0 }}>
                        Порог: <strong>{compareQ.data.cutoff}</strong>, разница с суммой:{' '}
                        <strong>{compareQ.data.gapToCutoff ?? '—'}</strong>
                      </Typography.Paragraph>
                    ) : (
                      <Typography.Text type="secondary">Нет числового порога в таблице для этой пары.</Typography.Text>
                    )}
                  </div>
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
