import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { BookOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { PageHero } from '../components/PageHero';
import { getLocalizedText } from '../lib/questionContent';

const PAGE_SIZE = 20;
const { Search, TextArea } = Input;

type LessonNoteStatus = 'pending' | 'under_review' | 'resolved' | 'rejected';
type LessonNoteReason =
  | 'wrong_topic'
  | 'incorrect_explanation'
  | 'unclear_explanation'
  | 'typo'
  | 'outdated_content'
  | 'other';

type LessonNoteRow = {
  id: string;
  userId: string;
  themeLessonId?: string | null;
  topicLessonId?: string | null;
  subjectId?: string | null;
  themeId?: string | null;
  topicId?: string | null;
  language: string;
  lessonVersion: string;
  reason: LessonNoteReason;
  message: string;
  status: LessonNoteStatus;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    telegramUsername?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  reviewer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    telegramUsername?: string | null;
    email?: string | null;
  } | null;
  lesson?: {
    kind: 'theme' | 'topic';
    id: string;
    title: string;
    model: string;
    theme?: { id: string; key: string; name: unknown } | null;
    topic?: { id: string; name: unknown } | null;
    subject?: { id: string; slug: string; name: unknown } | null;
  } | null;
};

type LessonNoteListResponse = {
  items: LessonNoteRow[];
  total: number;
  page: number;
  limit: number;
  stats: {
    open: number;
    pending: number;
    underReview: number;
    resolved: number;
    rejected: number;
  };
};

function statusLabel(status: LessonNoteStatus) {
  switch (status) {
    case 'pending':
      return 'Новая';
    case 'under_review':
      return 'В работе';
    case 'resolved':
      return 'Исправлено';
    case 'rejected':
      return 'Отклонено';
  }
}

function statusTag(status: LessonNoteStatus) {
  const color: Record<LessonNoteStatus, string> = {
    pending: 'orange',
    under_review: 'blue',
    resolved: 'green',
    rejected: 'default',
  };
  return <Tag color={color[status]}>{statusLabel(status)}</Tag>;
}

function reasonLabel(reason: LessonNoteReason) {
  switch (reason) {
    case 'wrong_topic':
      return 'Не та тема';
    case 'incorrect_explanation':
      return 'Ошибка в объяснении';
    case 'unclear_explanation':
      return 'Непонятно';
    case 'typo':
      return 'Опечатка';
    case 'outdated_content':
      return 'Устарело';
    case 'other':
      return 'Другое';
  }
}

function formatUser(row: LessonNoteRow) {
  const user = row.user;
  if (!user) return 'Пользователь';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.telegramUsername || user.email || user.phone || 'Пользователь';
}

function lessonTopic(row: LessonNoteRow) {
  const lesson = row.lesson;
  if (!lesson) return 'Урок';
  return (
    getLocalizedText(lesson.theme?.name) ||
    getLocalizedText(lesson.topic?.name) ||
    lesson.theme?.key ||
    lesson.title ||
    'Урок'
  );
}

export function AiLessonNotesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LessonNoteStatus | ''>('pending');
  const [reason, setReason] = useState<LessonNoteReason | ''>('');
  const [selected, setSelected] = useState<LessonNoteRow | null>(null);
  const [form] = Form.useForm<{ status: LessonNoteStatus; adminNote: string }>();

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['admin-ai-lesson-notes', page, search, status, reason],
    queryFn: async () => {
      const { data } = await api.get<LessonNoteListResponse>('/admin/ai/lesson-notes', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: status || undefined,
          reason: reason || undefined,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!selected || !data) return;
    const fresh = data.items.find((item) => item.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [data, selected]);

  useEffect(() => {
    if (!selected) return;
    form.setFieldsValue({
      status: selected.status,
      adminNote: selected.adminNote || '',
    });
  }, [form, selected]);

  const updateNote = useMutation({
    mutationFn: async (payload: { id: string; status: LessonNoteStatus; adminNote: string }) => {
      const { data } = await api.patch<LessonNoteRow>(`/admin/ai/lesson-notes/${payload.id}`, {
        status: payload.status,
        adminNote: payload.adminNote,
      });
      return data;
    },
    onSuccess: (updated) => {
      message.success('Заметка обновлена');
      setSelected(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-ai-lesson-notes'] });
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Не удалось обновить заметку');
    },
  });

  const rows = data?.items ?? [];
  const stats = data?.stats ?? {
    open: 0,
    pending: 0,
    underReview: 0,
    resolved: 0,
    rejected: 0,
  };

  const columns: ColumnsType<LessonNoteRow> = useMemo(
    () => [
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 120,
        render: (value: LessonNoteStatus) => statusTag(value),
      },
      {
        title: 'Причина',
        dataIndex: 'reason',
        width: 170,
        render: (value: LessonNoteReason) => reasonLabel(value),
      },
      {
        title: 'Урок',
        key: 'lesson',
        render: (_: unknown, row) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{lessonTopic(row)}</Typography.Text>
            <Typography.Text type="secondary">
              {getLocalizedText(row.lesson?.subject?.name) || row.lesson?.subject?.slug || 'Предмет'} · {row.language} · {row.lessonVersion}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Замечание',
        dataIndex: 'message',
        render: (value: string) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
            {value}
          </Typography.Paragraph>
        ),
      },
      {
        title: 'Ученик',
        key: 'user',
        width: 180,
        render: (_: unknown, row) => formatUser(row),
      },
      {
        title: 'Дата',
        dataIndex: 'createdAt',
        width: 150,
        render: (value: string) => new Date(value).toLocaleString('ru-RU'),
      },
      {
        title: '',
        key: 'actions',
        width: 120,
        render: (_: unknown, row) => (
          <Button size="small" onClick={() => setSelected(row)}>
            Открыть
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <AdminPageShell wide>
      <PageHero
        eyebrow="AI-контент"
        eyebrowIcon={<BookOutlined />}
        title="Замечания к AI-урокам"
        lede="Очередь пользовательских примечаний к сохранённым урокам. Здесь команда видит проблемную тему, текст замечания и закрывает задачу после исправления материала."
        aside={
          <Card size="small">
            <Space size="large">
              <div>
                <Typography.Text type="secondary">Открыто</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {stats.open}
                </Typography.Title>
              </div>
              <div>
                <Typography.Text type="secondary">Исправлено</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {stats.resolved}
                </Typography.Title>
              </div>
            </Space>
          </Card>
        }
      />

      <Card>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Search
              allowClear
              placeholder="Поиск по тексту, пользователю или UUID"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onSearch={(value) => {
                setPage(1);
                setSearch(value.trim());
              }}
              style={{ width: 320 }}
            />
            <Select
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              style={{ width: 170 }}
              options={[
                { value: '', label: 'Все статусы' },
                { value: 'pending', label: 'Новые' },
                { value: 'under_review', label: 'В работе' },
                { value: 'resolved', label: 'Исправлено' },
                { value: 'rejected', label: 'Отклонено' },
              ]}
            />
            <Select
              value={reason}
              onChange={(value) => {
                setPage(1);
                setReason(value);
              }}
              style={{ width: 210 }}
              options={[
                { value: '', label: 'Все причины' },
                { value: 'wrong_topic', label: 'Не та тема' },
                { value: 'incorrect_explanation', label: 'Ошибка в объяснении' },
                { value: 'unclear_explanation', label: 'Непонятно' },
                { value: 'typo', label: 'Опечатка' },
                { value: 'outdated_content', label: 'Устарело' },
                { value: 'other', label: 'Другое' },
              ]}
            />
          </Space>
          <Button icon={<SyncOutlined spin={isFetching} />} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-ai-lesson-notes'] })}>
            Обновить
          </Button>
        </Space>
      </Card>

      <Card>
        <Table<LessonNoteRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isPending || isFetching}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </Card>

      <Drawer
        title={selected ? lessonTopic(selected) : 'Замечание'}
        open={!!selected}
        width={620}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Статус">{statusTag(selected.status)}</Descriptions.Item>
              <Descriptions.Item label="Причина">{reasonLabel(selected.reason)}</Descriptions.Item>
              <Descriptions.Item label="Ученик">{formatUser(selected)}</Descriptions.Item>
              <Descriptions.Item label="Предмет">
                {getLocalizedText(selected.lesson?.subject?.name) || selected.lesson?.subject?.slug || 'Предмет'}
              </Descriptions.Item>
              <Descriptions.Item label="Версия">
                {selected.language} · {selected.lessonVersion} · {selected.lesson?.model}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Текст замечания">
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {selected.message}
              </Typography.Paragraph>
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={(values) =>
                updateNote.mutate({
                  id: selected.id,
                  status: values.status,
                  adminNote: values.adminNote || '',
                })
              }
            >
              <Form.Item label="Статус" name="status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'pending', label: 'Новая' },
                    { value: 'under_review', label: 'В работе' },
                    { value: 'resolved', label: 'Исправлено' },
                    { value: 'rejected', label: 'Отклонено' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="Комментарий администратора" name="adminNote">
                <TextArea rows={5} placeholder="Что исправили или почему отклонили замечание" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={updateNote.isPending}>
                Сохранить решение
              </Button>
            </Form>
          </Space>
        )}
      </Drawer>
    </AdminPageShell>
  );
}
