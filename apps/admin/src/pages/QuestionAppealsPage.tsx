import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { FlagOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';
import { getLocalizedText } from '../lib/questionContent';

const PAGE_SIZE = 20;
const { TextArea, Search } = Input;

type AppealStatus = 'pending' | 'under_review' | 'resolved' | 'rejected';
type AppealReason =
  | 'incorrect_answer'
  | 'ambiguous_wording'
  | 'outdated_content'
  | 'broken_media'
  | 'other';

type CatalogSubject = {
  id: string;
  slug: string;
  name: unknown;
};

type CatalogExam = {
  id: string;
  slug: string;
  name: unknown;
  subjects: CatalogSubject[];
};

type AppealRow = {
  id: string;
  userId: string;
  sessionId: string;
  questionId: string;
  examTypeId: string;
  subjectId: string;
  reason: AppealReason;
  message: string;
  status: AppealStatus;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  questionPreview: string;
  questionSnapshot?: unknown;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    telegramUsername?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  reviewer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    telegramUsername?: string | null;
    email?: string | null;
  } | null;
  session?: {
    id: string;
    status: string;
    language?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  };
  subject?: {
    id: string;
    slug: string;
    name: unknown;
  };
  examType?: {
    id: string;
    slug: string;
    name: unknown;
  };
};

type AppealListResponse = {
  items: AppealRow[];
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

function statusLabel(status: AppealStatus) {
  if (status === 'pending') return 'Новая';
  if (status === 'under_review') return 'В работе';
  if (status === 'resolved') return 'Решена';
  return 'Отклонена';
}

function statusTag(status: AppealStatus) {
  if (status === 'pending') return <Tag color="blue">Новая</Tag>;
  if (status === 'under_review') return <Tag color="gold">В работе</Tag>;
  if (status === 'resolved') return <Tag color="green">Решена</Tag>;
  return <Tag color="red">Отклонена</Tag>;
}

function reasonLabel(reason: AppealReason) {
  if (reason === 'incorrect_answer') return 'Неверный ответ';
  if (reason === 'ambiguous_wording') return 'Неясная формулировка';
  if (reason === 'outdated_content') return 'Устаревший контент';
  if (reason === 'broken_media') return 'Проблема с медиа';
  return 'Другое';
}

function formatUser(row: AppealRow) {
  const fullName = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || row.user?.telegramUsername || row.user?.email || row.user?.phone || row.userId;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export function QuestionAppealsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AppealStatus | ''>('pending');
  const [reason, setReason] = useState<AppealReason | ''>('');
  const [examTypeId, setExamTypeId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [selected, setSelected] = useState<AppealRow | null>(null);
  const [form] = Form.useForm<{ status: AppealStatus; adminNote: string }>();

  const { data: catalog } = useQuery({
    queryKey: ['admin-exams-catalog-for-appeals'],
    queryFn: async () => {
      const { data } = await api.get<CatalogExam[]>('/admin/exams/catalog', {
        params: { includeInactive: 'true' },
      });
      return data;
    },
  });

  const examOptions = useMemo(
    () =>
      (catalog ?? []).map((exam) => ({
        value: exam.id,
        label: getLocalizedText(exam.name) || exam.slug,
      })),
    [catalog],
  );

  const subjectOptions = useMemo(() => {
    const exam = (catalog ?? []).find((item) => item.id === examTypeId);
    return (exam?.subjects ?? []).map((subject) => ({
      value: subject.id,
      label: getLocalizedText(subject.name) || subject.slug,
    }));
  }, [catalog, examTypeId]);

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['admin-question-appeals', page, search, status, reason, examTypeId, subjectId],
    queryFn: async () => {
      const { data } = await api.get<AppealListResponse>('/admin/question-appeals', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: status || undefined,
          reason: reason || undefined,
          examTypeId: examTypeId || undefined,
          subjectId: subjectId || undefined,
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

  const updateAppeal = useMutation({
    mutationFn: async (payload: { id: string; status: AppealStatus; adminNote: string }) => {
      const { data } = await api.patch<AppealRow>(`/admin/question-appeals/${payload.id}`, {
        status: payload.status,
        adminNote: payload.adminNote,
      });
      return data;
    },
    onSuccess: (updated) => {
      message.success('Апелляция обновлена');
      setSelected(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-question-appeals'] });
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Не удалось обновить апелляцию');
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

  const columns: ColumnsType<AppealRow> = useMemo(
    () => [
      {
        title: 'Статус',
        dataIndex: 'status',
        width: 120,
        render: (value: AppealStatus) => statusTag(value),
      },
      {
        title: 'Причина',
        dataIndex: 'reason',
        width: 180,
        render: (value: AppealReason) => reasonLabel(value),
      },
      {
        title: 'Вопрос',
        dataIndex: 'questionPreview',
        render: (value: string, row: AppealRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{value}</div>
            <div className="hig-cell-muted">
              {getLocalizedText(row.examType?.name) || row.examType?.slug || '—'} •{' '}
              {getLocalizedText(row.subject?.name) || row.subject?.slug || '—'}
            </div>
          </div>
        ),
      },
      {
        title: 'Пользователь',
        width: 220,
        render: (_: unknown, row: AppealRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{formatUser(row)}</div>
            <div className="hig-cell-muted">{row.user?.telegramUsername ? `@${row.user.telegramUsername}` : row.user?.email || row.user?.phone || row.userId}</div>
          </div>
        ),
      },
      {
        title: 'Создана',
        dataIndex: 'createdAt',
        width: 170,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: '',
        width: 150,
        fixed: 'right',
        render: (_: unknown, row: AppealRow) => (
          <Button type="link" onClick={() => setSelected(row)}>
            Открыть
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <AdminPageShell wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Typography.Text type="secondary">
                <FlagOutlined /> Контроль качества вопросов
              </Typography.Text>
              <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>
                Апелляции
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 760 }}>
                Очередь пользовательских апелляций по вопросам из завершённых тестов. Здесь видно контекст вопроса,
                комментарий ученика и можно оставить финальное решение, которое вернётся в пользовательский review.
              </Typography.Paragraph>
            </div>
            <Space direction="vertical" align="end" size={6}>
              <Tag color={isFetching ? 'processing' : 'default'} icon={isFetching ? <SyncOutlined spin /> : undefined}>
                {isFetching ? 'Обновление данных' : 'Production feed'}
              </Tag>
              <Typography.Text type="secondary">{new Date().toLocaleString('ru-RU')}</Typography.Text>
            </Space>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Typography.Text type="secondary">Открытые</Typography.Text>
              <Typography.Title level={2} style={{ margin: '8px 0 0' }}>
                {stats.open}
              </Typography.Title>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Typography.Text type="secondary">Новые</Typography.Text>
              <Typography.Title level={2} style={{ margin: '8px 0 0' }}>
                {stats.pending}
              </Typography.Title>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Typography.Text type="secondary">В работе</Typography.Text>
              <Typography.Title level={2} style={{ margin: '8px 0 0' }}>
                {stats.underReview}
              </Typography.Title>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Typography.Text type="secondary">Решено / отклонено</Typography.Text>
              <Typography.Title level={2} style={{ margin: '8px 0 0' }}>
                {stats.resolved + stats.rejected}
              </Typography.Title>
            </Card>
          </Col>
        </Row>

        <Card>
          <Space wrap size={12} style={{ width: '100%' }}>
            <Search
              allowClear
              placeholder="Поиск по тексту, user id, session id, username"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
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
              style={{ width: 180 }}
              options={[
                { value: '', label: 'Все статусы' },
                { value: 'pending', label: 'Новая' },
                { value: 'under_review', label: 'В работе' },
                { value: 'resolved', label: 'Решена' },
                { value: 'rejected', label: 'Отклонена' },
              ]}
            />
            <Select
              value={reason}
              onChange={(value) => {
                setPage(1);
                setReason(value);
              }}
              style={{ width: 220 }}
              options={[
                { value: '', label: 'Все причины' },
                { value: 'incorrect_answer', label: 'Неверный ответ' },
                { value: 'ambiguous_wording', label: 'Неясная формулировка' },
                { value: 'outdated_content', label: 'Устаревший контент' },
                { value: 'broken_media', label: 'Проблема с медиа' },
                { value: 'other', label: 'Другое' },
              ]}
            />
            <Select
              allowClear
              value={examTypeId || undefined}
              placeholder="Экзамен"
              onChange={(value) => {
                setPage(1);
                setExamTypeId(value || '');
                setSubjectId('');
              }}
              style={{ width: 220 }}
              options={examOptions}
            />
            <Select
              allowClear
              value={subjectId || undefined}
              placeholder="Предмет"
              disabled={!examTypeId}
              onChange={(value) => {
                setPage(1);
                setSubjectId(value || '');
              }}
              style={{ width: 220 }}
              options={subjectOptions}
            />
            <Button
              onClick={() => {
                setPage(1);
                setSearchDraft('');
                setSearch('');
                setStatus('pending');
                setReason('');
                setExamTypeId('');
                setSubjectId('');
              }}
            >
              Сбросить
            </Button>
          </Space>
        </Card>

        <HigTableCard>
          <Table
            rowKey="id"
            loading={isPending}
            dataSource={rows}
            columns={columns}
            locale={{
              emptyText: (
                <Empty
                  description="Апелляции не найдены"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              onChange: setPage,
            }}
            onRow={(record) => ({
              onClick: () => setSelected(record),
              style: { cursor: 'pointer' },
            })}
            scroll={{ x: 1100 }}
          />
        </HigTableCard>
      </div>

      <Drawer
        open={!!selected}
        width={720}
        title={selected ? `Апелляция ${statusLabel(selected.status).toLowerCase()}` : 'Апелляция'}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              type={selected.status === 'rejected' ? 'error' : selected.status === 'resolved' ? 'success' : 'info'}
              showIcon
              message={`${reasonLabel(selected.reason)} • ${statusLabel(selected.status)}`}
              description={selected.adminNote || 'Пока без финального комментария команды.'}
            />

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Вопрос">{selected.questionPreview}</Descriptions.Item>
              <Descriptions.Item label="Пользователь">
                <Space direction="vertical" size={0}>
                  <span>{formatUser(selected)}</span>
                  <Link to={`/users/${selected.userId}`}>Открыть пользователя</Link>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Экзамен / предмет">
                {(getLocalizedText(selected.examType?.name) || selected.examType?.slug || '—') +
                  ' / ' +
                  (getLocalizedText(selected.subject?.name) || selected.subject?.slug || '—')}
              </Descriptions.Item>
              <Descriptions.Item label="Сессия">
                <Space direction="vertical" size={0}>
                  <span>{selected.sessionId}</span>
                  <span className="hig-cell-muted">
                    {selected.session?.status || '—'} • язык {selected.session?.language || '—'}
                  </span>
                  <Link to={`/questions?id=${selected.questionId}`}>Открыть вопрос в редакторе</Link>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Комментарий ученика">
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {selected.message}
                </Typography.Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Создана">{formatDateTime(selected.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Последнее решение">
                {selected.reviewedAt ? formatDateTime(selected.reviewedAt) : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Решение команды">
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  status: selected.status,
                  adminNote: selected.adminNote || '',
                }}
                onFinish={(values) => {
                  updateAppeal.mutate({
                    id: selected.id,
                    status: values.status,
                    adminNote: values.adminNote || '',
                  });
                }}
              >
                <Form.Item name="status" label="Статус" rules={[{ required: true, message: 'Выберите статус' }]}>
                  <Select
                    options={[
                      { value: 'pending', label: 'Новая' },
                      { value: 'under_review', label: 'В работе' },
                      { value: 'resolved', label: 'Решена' },
                      { value: 'rejected', label: 'Отклонена' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="adminNote" label="Комментарий администратора">
                  <TextArea
                    rows={6}
                    placeholder="Что проверили, какое решение приняли, нужно ли пользователю что-то пояснить."
                  />
                </Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={updateAppeal.isPending}>
                    Сохранить решение
                  </Button>
                  <Button
                    onClick={() => {
                      form.setFieldsValue({
                        status: selected.status,
                        adminNote: selected.adminNote || '',
                      });
                    }}
                  >
                    Вернуть значения
                  </Button>
                </Space>
              </Form>
            </Card>

            <Card title="Технический снимок">
              <Typography.Paragraph type="secondary">
                Снимок хранится на момент отправки апелляции и нужен для аудита, даже если вопрос позже поменяется.
              </Typography.Paragraph>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 320,
                  overflow: 'auto',
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(60, 60, 67, 0.06)',
                  fontSize: 12,
                }}
              >
                {JSON.stringify(selected.questionSnapshot, null, 2)}
              </pre>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </AdminPageShell>
  );
}
