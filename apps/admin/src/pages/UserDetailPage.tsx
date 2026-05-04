import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Tag,
  Tabs,
  Table,
  Spin,
  Descriptions,
  Badge,
  Button,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { normalizeKzPhone } from '@bilimland/shared';

interface UserProfile {
  id: string;
  telegramId: number | null;
  telegramUsername: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: string;
  isChannelMember: boolean;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
  createdAt: string;
  entitlements?: Array<{
    id: string;
    examTypeId: string;
    tier: string;
    status: string;
    totalAttemptsLimit: number | null;
    usedAttemptsTotal: number;
    dailyAttemptsLimit: number | null;
    nextAllowedAt: string | null;
    examType?: { slug: string; name: unknown };
    planTemplate?: { code: string; name: string };
    subscription?: { planType: string; isActive: boolean };
  }>;
  subscriptions?: Array<{
    id: string;
    planType: string;
    isActive: boolean;
    startsAt: string;
    expiresAt: string;
    paymentNote: string | null;
  }>;
}

interface SessionRow {
  id: string;
  examTypeSlug: string;
  examTypeName: unknown;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationSecs: number | null;
  score: number | null;
  correctCount: number | null;
  totalQuestions: number;
}

interface FunnelStep {
  id: string;
  step: string;
  createdAt: string;
}

interface UserDetailResponse {
  user: UserProfile;
  sessions: SessionRow[];
  funnelSteps: FunnelStep[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusTag({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Tag icon={<CheckCircleOutlined />} color="success">Завершён</Tag>;
    case 'timed_out':
      return <Tag icon={<ClockCircleOutlined />} color="warning">Время вышло</Tag>;
    case 'in_progress':
      return <Tag icon={<ClockCircleOutlined />} color="processing">В процессе</Tag>;
    case 'abandoned':
      return <Tag icon={<CloseCircleOutlined />} color="default">Брошен</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery<UserDetailResponse>({
    queryKey: ['admin-user', id],
    queryFn: async () => {
      const { data } = await api.get<UserDetailResponse>(`/admin/users/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });

  const revokeSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      await api.delete(`/admin/subscriptions/${subscriptionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Подписка удалена');
    },
    onError: () => {
      message.error('Не удалось удалить подписку');
    },
  });

  const revokeEntitlement = useMutation({
    mutationFn: async (entitlementId: string) => {
      await api.patch(`/admin/subscriptions/entitlements/${entitlementId}`, { status: 'revoked' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Доступ отозван');
    },
    onError: () => {
      message.error('Не удалось отозвать доступ');
    },
  });

  if (isPending) {
    return (
      <AdminPageShell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </AdminPageShell>
    );
  }

  if (error || !data) {
    return (
      <AdminPageShell>
        <Empty description="Пользователь не найден" />
      </AdminPageShell>
    );
  }

  const { user, sessions } = data;

  const sessionColumns: ColumnsType<SessionRow> = [
    {
      title: 'Экзамен',
      dataIndex: 'examTypeSlug',
      width: 100,
      render: (v: string) => v.toUpperCase(),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 130,
      render: (_: unknown, r: SessionRow) => <StatusTag status={r.status} />,
    },
    {
      title: 'Начат',
      dataIndex: 'startedAt',
      width: 150,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Завершён',
      dataIndex: 'finishedAt',
      width: 150,
      render: (v: string | null) => (v ? formatDate(v) : '—'),
    },
    {
      title: 'Длит.',
      dataIndex: 'durationSecs',
      width: 80,
      render: (v: number | null) =>
        v != null ? `${Math.floor(v / 60)}м ${v % 60}с` : '—',
    },
    {
      title: 'Балл',
      dataIndex: 'score',
      width: 80,
      render: (score: number | null) =>
        score != null ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score.toFixed(1)}</span> : '—',
    },
    {
      title: 'Верно',
      dataIndex: 'correctCount',
      width: 80,
      render: (v: number | null, r: SessionRow) =>
        v != null ? `${v}/${r.totalQuestions}` : '—',
    },
  ];

  return (
    <AdminPageShell>
      <div className="pg-user-detail">
        <div className="pg-user-detail__back">
          <Link to="/users">
            <Button type="text" icon={<ArrowLeftOutlined />} size="small">
              К списку
            </Button>
          </Link>
        </div>

        <Descriptions size="small" bordered column={2} className="pg-user-detail__info">
          <Descriptions.Item label="Telegram ID">
            <code>{user.telegramId}</code>
          </Descriptions.Item>
          <Descriptions.Item label="Username">
            {user.telegramUsername ? `@${user.telegramUsername}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Телефон">
            {user.phone ? `+${normalizeKzPhone(user.phone)}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Имя">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Язык">
            {user.preferredLanguage.toUpperCase()}
          </Descriptions.Item>
          <Descriptions.Item label="Канал">
            {user.isChannelMember ? (
              <Tag color="green">Участник</Tag>
            ) : (
              <Tag>Нет</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Premium">
            {user.hasActiveSubscription ? (
              <Tag color="gold" icon={<TrophyOutlined />}>Да</Tag>
            ) : (
              <Tag>Нет</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Админ">
            {user.isAdmin ? <Tag color="purple">Да</Tag> : <Tag>Нет</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Регистрация">
            {formatDate(user.createdAt)}
          </Descriptions.Item>
        </Descriptions>

        <Tabs
          defaultActiveKey="sessions"
          items={[
            {
              key: 'sessions',
              label: `Сессии (${sessions.length})`,
              children: (
                <Card size="small">
                  <Table
                    columns={sessionColumns}
                    dataSource={sessions}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 600 }}
                    locale={{ emptyText: <Empty description="Нет сессий" /> }}
                  />
                </Card>
              ),
            },
            {
              key: 'entitlements',
              label: `Доступ (${user.entitlements?.length ?? 0})`,
              children: (
                <Card size="small">
                  {!user.entitlements || user.entitlements.length === 0 ? (
                    <Empty description="Нет активного доступа" />
                  ) : (
                    <div className="pg-user-detail__ent-list">
                      {user.entitlements.map((ent) => {
                        const remaining =
                          ent.totalAttemptsLimit == null
                            ? '∞'
                            : `${Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal)}/${ent.totalAttemptsLimit}`;
                        return (
                          <div key={ent.id} className="pg-user-detail__ent-item">
                            <div className="pg-user-detail__ent-header">
                              <Tag color={ent.tier === 'paid' ? 'gold' : 'default'}>
                                {(ent.examType?.slug ?? 'exam').toUpperCase()}
                              </Tag>
                              <Badge
                                status={ent.status === 'active' ? 'success' : 'default'}
                                text={ent.status === 'active' ? 'Активен' : ent.status}
                              />
                              {ent.status === 'active' && (
                                <Popconfirm
                                  title="Отозвать доступ?"
                                  description="Пользователь потеряет доступ к этому экзамену."
                                  okText="Отозвать"
                                  cancelText="Отмена"
                                  okButtonProps={{ danger: true, loading: revokeEntitlement.isPending }}
                                  onConfirm={() => revokeEntitlement.mutate(ent.id)}
                                >
                                  <Button
                                    danger
                                    size="small"
                                    icon={<StopOutlined />}
                                    loading={revokeEntitlement.isPending}
                                  >
                                    Отозвать
                                  </Button>
                                </Popconfirm>
                              )}
                            </div>
                            <div className="pg-user-detail__ent-meta">
                              <span>Осталось попыток: {remaining}</span>
                              {ent.dailyAttemptsLimit != null && (
                                <span>Лимит в день: {ent.dailyAttemptsLimit}</span>
                              )}
                              {ent.nextAllowedAt && (
                                <span>Следующая: {formatDate(ent.nextAllowedAt)}</span>
                              )}
                            </div>
                            {ent.planTemplate && (
                              <div className="pg-user-detail__ent-source">
                                Шаблон: {ent.planTemplate.name} ({ent.planTemplate.code})
                              </div>
                            )}
                            {ent.subscription && (
                              <div className="pg-user-detail__ent-source">
                                Подписка: {ent.subscription.planType}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ),
            },
            {
              key: 'subscriptions',
              label: `Подписки (${user.subscriptions?.length ?? 0})`,
              children: (
                <Card size="small">
                  {!user.subscriptions || user.subscriptions.length === 0 ? (
                    <Empty description="Нет подписок" />
                  ) : (
                    <Table
                      dataSource={user.subscriptions}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        {
                          title: 'План',
                          dataIndex: 'planType',
                        },
                        {
                          title: 'Статус',
                          dataIndex: 'isActive',
                          width: 100,
                          render: (v: boolean) =>
                            v ? <Tag color="green">Активна</Tag> : <Tag>Неактивна</Tag>,
                        },
                        {
                          title: 'Начало',
                          dataIndex: 'startsAt',
                          render: (v: string) => formatDate(v),
                        },
                        {
                          title: 'Истекает',
                          dataIndex: 'expiresAt',
                          render: (v: string) => formatDate(v),
                        },
                        {
                          title: 'Заметка',
                          dataIndex: 'paymentNote',
                          render: (v: string | null) => v ?? '—',
                        },
                        {
                          title: '',
                          key: 'actions',
                          width: 130,
                          render: (_: unknown, record) =>
                            record.isActive ? (
                              <Popconfirm
                                title="Удалить подписку?"
                                description="Пользователь потеряет доступ, связанный с этой подпиской."
                                okText="Удалить"
                                cancelText="Отмена"
                                okButtonProps={{ danger: true, loading: revokeSubscription.isPending }}
                                onConfirm={() => revokeSubscription.mutate(record.id)}
                              >
                                <Button
                                  danger
                                  size="small"
                                  icon={<StopOutlined />}
                                  loading={revokeSubscription.isPending}
                                >
                                  Удалить
                                </Button>
                              </Popconfirm>
                            ) : null,
                        },
                      ]}
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>
    </AdminPageShell>
  );
}
