import { useMemo, useState } from 'react';
import { Card, Col, InputNumber, Row, Slider, Space, Tag, Typography } from 'antd';
import {
  ENT_MAX,
  ENT_THRESHOLD_2026,
  ENT_TOTAL_MAX,
  grantTierHint,
  passesThresholds,
  totalEntScore,
  type EntScores,
} from '@bilimland/shared';

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

  const total = useMemo(() => totalEntScore(scores), [scores]);
  const passed = useMemo(() => passesThresholds(scores), [scores]);
  const tier = useMemo(() => grantTierHint(total, passed), [total, passed]);
  const tierInfo = tierRu[tier];

  const set =
    (key: keyof EntScores) =>
    (v: number) =>
      setScores((s) => ({ ...s, [key]: v }));

  return (
    <div>
      <h2 className="admin-page-title">Шанс поступления (модель ҰБТ 2026)</h2>
      <p className="admin-page-lead">
        Интерактивная оценка по порогам и суммарному баллу (максимум {ENT_TOTAL_MAX}). Категории —
        ориентир для мотивации, не юридическая гарантия зачисления.
      </p>

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
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
