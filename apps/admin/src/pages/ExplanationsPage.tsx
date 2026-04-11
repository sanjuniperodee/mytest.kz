import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography, Button, Space, Spin, Empty, Card, Segmented } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  getLocalizedText,
  getQuestionContentLocale,
  getQuestionPreviewText,
  localeFilterParam,
} from '../lib/questionContent';

type LocaleFilter = '' | 'kk' | 'ru' | 'unset';

interface Row {
  id: string;
  examTypeId: string;
  subjectId: string;
  difficulty: number;
  type: string;
  content: unknown;
  explanation: unknown;
  metadata?: Record<string, unknown> | null;
  subject?: { name: unknown };
  examType?: { name: unknown };
}

function localeTag(locale: ReturnType<typeof getQuestionContentLocale>) {
  if (locale === 'kk') return <Tag color="gold">KK</Tag>;
  if (locale === 'ru') return <Tag color="cyan">RU</Tag>;
  return <Tag>—</Tag>;
}

export function ExplanationsPage() {
  const [page, setPage] = useState(1);
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>('');
  const [previewLang, setPreviewLang] = useState<'kk' | 'ru'>('ru');

  const localeParams = useMemo(() => localeFilterParam(localeFilter), [localeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-questions-explanations', page, localeFilter],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/questions', {
        params: { hasExplanation: true, page, limit: 15, ...localeParams },
      });
      return res as { items: Row[]; total: number; page: number; limit: number };
    },
  });

  const columns: ColumnsType<Row> = useMemo(
    () => [
      {
        title: 'Вопрос',
        render: (_: unknown, record: Row) => {
          const text = getQuestionPreviewText(record, previewLang) || '—';
          const s = String(text);
          return (
            <span>
              {s.slice(0, 100)}
              {s.length > 100 ? '…' : ''}
            </span>
          );
        },
      },
      {
        title: 'Язык',
        width: 88,
        render: (_: unknown, record: Row) => localeTag(getQuestionContentLocale(record.metadata)),
      },
      {
        title: 'Группа',
        width: 240,
        render: (_: unknown, record: Row) => (
          <Space size={4} wrap>
            <Tag color="blue">{getLocalizedText(record.examType?.name) || '—'}</Tag>
            <Tag color="purple">{getLocalizedText(record.subject?.name) || '—'}</Tag>
          </Space>
        ),
      },
      {
        title: 'Объяснение',
        width: 280,
        render: (_: unknown, record: Row) => {
          const text = getLocalizedText(record.explanation) || '—';
          const s = String(text);
          return (
            <span style={{ color: '#475569' }}>
              {s.slice(0, 90)}
              {s.length > 90 ? '…' : ''}
            </span>
          );
        },
      },
      {
        title: '',
        width: 160,
        fixed: 'right',
        render: (_: unknown, record: Row) => (
          <Link to={`/questions?id=${record.id}`}>
            <Button type="link" size="small">
              К вопросам
            </Button>
          </Link>
        ),
      },
    ],
    [previewLang],
  );

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <h2 className="admin-page-title">Объяснения вопросов</h2>
      <p className="admin-page-lead">
        Записи с заполненным полем объяснения. Фильтр по языку контента — как в разделе «Вопросы». Превью текста
        вопроса можно переключать KK/RU.
      </p>

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap align="center">
          <Typography.Text type="secondary">Язык контента:</Typography.Text>
          <Segmented
            value={localeFilter || 'all'}
            onChange={(v) => {
              setLocaleFilter(v === 'all' ? '' : (v as LocaleFilter));
              setPage(1);
            }}
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Қазақша', value: 'kk' },
              { label: 'Русский', value: 'ru' },
              { label: 'Без метки', value: 'unset' },
            ]}
          />
          <Typography.Text type="secondary">Превью:</Typography.Text>
          <Segmented
            value={previewLang}
            onChange={(v) => setPreviewLang(v as 'kk' | 'ru')}
            options={[
              { label: 'KK', value: 'kk' },
              { label: 'RU', value: 'ru' },
            ]}
          />
        </Space>
      </Card>

      <Table<Row>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        pagination={{
          current: page,
          total: data?.total ?? 0,
          pageSize: 15,
          onChange: setPage,
          showTotal: (t) => `Всего: ${t}`,
        }}
        locale={{
          emptyText: <Empty description="Нет вопросов с объяснениями" />,
        }}
        scroll={{ x: 960 }}
      />

      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        API: <Typography.Text code>hasExplanation=true</Typography.Text> и опционально{' '}
        <Typography.Text code>contentLocale</Typography.Text>.
      </Typography.Paragraph>
    </div>
  );
}
