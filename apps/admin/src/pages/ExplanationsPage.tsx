import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography, Button, Space, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Row {
  id: string;
  examTypeId: string;
  subjectId: string;
  difficulty: number;
  type: string;
  content: unknown;
  explanation: unknown;
  subject?: { name: unknown };
  examType?: { name: unknown };
}

function getLocalizedText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const candidates = ['ru', 'kk', 'en'];
    for (const lang of candidates) {
      const v = o[lang];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'object' && v !== null && typeof (v as { text?: string }).text === 'string') {
        const t = (v as { text: string }).text;
        if (t.trim()) return t;
      }
    }
    if (typeof o.text === 'string' && o.text.trim()) return o.text;
  }
  return '';
}

export function ExplanationsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-questions-explanations', page],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/questions', {
        params: { hasExplanation: true, page, limit: 15 },
      });
      return res as { items: Row[]; total: number; page: number; limit: number };
    },
  });

  const columns: ColumnsType<Row> = [
    {
      title: 'Вопрос (превью)',
      render: (_: unknown, record: Row) => {
        const text = getLocalizedText(record.content) || '—';
        const s = String(text);
        return <span>{s.slice(0, 100)}{s.length > 100 ? '…' : ''}</span>;
      },
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
      title: 'Объяснение (превью)',
      width: 280,
      render: (_: unknown, record: Row) => {
        const text = getLocalizedText(record.explanation) || '—';
        const s = String(text);
        return <span style={{ color: '#475569' }}>{s.slice(0, 90)}{s.length > 90 ? '…' : ''}</span>;
      },
    },
    {
      title: '',
      width: 160,
      fixed: 'right',
      render: (_: unknown, record: Row) => (
        <Link to={`/questions?id=${record.id}`}>
          <Button type="link" size="small">
            Открыть в вопросах
          </Button>
        </Link>
      ),
    },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <h2 className="admin-page-title">Объяснение вопросов</h2>
      <p className="admin-page-lead">
        Вопросы, у которых в базе заполнено поле объяснения (premium). Переходите в раздел «Вопросы» для
        редактирования — строка с нужным ID будет подсвечена.
      </p>

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
        scroll={{ x: 900 }}
      />

      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        Фильтр <code>hasExplanation=true</code> на API исключает записи без JSON-объяснения.
      </Typography.Paragraph>
    </div>
  );
}
