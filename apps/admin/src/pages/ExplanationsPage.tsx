import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography, Button, Space, Spin, Empty, Card, Segmented, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import {
  getLocalizedText,
  getQuestionContentLocale,
  getQuestionPreviewText,
  localeFilterParam,
  localeFilterToTabKey,
  tabKeyToLocaleFilter,
  LOCALE_TAB_KEYS,
  type AdminLocaleFilter,
} from '../lib/questionContent';

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
  const [localeFilter, setLocaleFilter] = useState<AdminLocaleFilter>('');
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
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <Tabs
        activeKey={localeFilterToTabKey(localeFilter)}
        onChange={(key) => {
          setLocaleFilter(tabKeyToLocaleFilter(key));
          setPage(1);
          if (key === LOCALE_TAB_KEYS.kk) setPreviewLang('kk');
          if (key === LOCALE_TAB_KEYS.ru) setPreviewLang('ru');
        }}
        type="line"
        size="middle"
        style={{ marginBottom: 12 }}
        items={[
          {
            key: LOCALE_TAB_KEYS.all,
            label: (
              <span>
                <strong>Барлығы</strong>
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                  / Все
                </Typography.Text>
              </span>
            ),
          },
          {
            key: LOCALE_TAB_KEYS.kk,
            label: (
              <span>
                <Tag color="gold" style={{ marginRight: 8 }}>
                  KK
                </Tag>
                Қазақша
              </span>
            ),
          },
          {
            key: LOCALE_TAB_KEYS.ru,
            label: (
              <span>
                <Tag color="cyan" style={{ marginRight: 8 }}>
                  RU
                </Tag>
                Русский
              </span>
            ),
          },
          {
            key: LOCALE_TAB_KEYS.unset,
            label: 'Без метки',
          },
        ]}
      />

      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '10px 14px' } }}>
        <Space wrap align="center">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Превью условия
          </Typography.Text>
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
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        pagination={{
          current: page,
          total: data?.total ?? 0,
          pageSize: 15,
          onChange: setPage,
          showTotal: (t) => `${t} шт.`,
        }}
        locale={{
          emptyText: <Empty description="Пусто" />,
        }}
        scroll={{ x: 960 }}
      />
    </AdminPageShell>
  );
}
