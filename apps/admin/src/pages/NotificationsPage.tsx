import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Button,
  Empty,
  InputNumber,
  message,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BellOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';

type CampaignRow = {
  id: string;
  key: string;
  title: string;
  isActive: boolean;
  cooldownHours: number;
  audience: number;
  sent: number;
  failed: number;
  lastAttemptedAt: string | null;
  updatedAt: string;
};

type NotificationRun = {
  id: string;
  source: string;
  status: string;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

type OverviewResponse = {
  campaigns: CampaignRow[];
  runs: NotificationRun[];
  settings: {
    enabled: boolean;
    pollIntervalMinutes: number;
    batchSize: number;
    quietHours: string;
    globalCooldownHours: number;
  };
};

type DeliveryLog = {
  id: string;
  campaignKey: string;
  status: string;
  targetTelegramId: number;
  attemptedAt: string;
  sentAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  user: {
    id: string;
    telegramId: number | null;
    telegramUsername: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    preferredLanguage: string;
  };
};

type LogsResponse = {
  items: DeliveryLog[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 20;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function statusTag(status: string) {
  const color =
    status === 'sent'
      ? 'green'
      : status === 'failed'
        ? 'red'
        : status === 'completed'
          ? 'blue'
          : status === 'running'
            ? 'gold'
            : 'default';
  return <Tag color={color}>{status}</Tag>;
}

function userLabel(user: DeliveryLog['user']) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.telegramUsername) return `@${user.telegramUsername}`;
  if (user.phone) return `+${user.phone}`;
  return user.id.slice(0, 8);
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [campaignFilter, setCampaignFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data: overview, isPending: overviewPending } = useQuery({
    queryKey: ['admin-notifications-overview'],
    queryFn: async () => (await api.get<OverviewResponse>('/admin/notifications/overview')).data,
  });

  const { data: logs, isFetching: logsFetching } = useQuery({
    queryKey: ['admin-notifications-logs', campaignFilter, statusFilter, page],
    queryFn: async () =>
      (
        await api.get<LogsResponse>('/admin/notifications/logs', {
          params: {
            page,
            limit: PAGE_SIZE,
            campaignKey: campaignFilter,
            status: statusFilter,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const campaignOptions = useMemo(
    () =>
      (overview?.campaigns ?? []).map((campaign) => ({
        value: campaign.key,
        label: campaign.key,
      })),
    [overview?.campaigns],
  );

  const toggleCampaign = useMutation({
    mutationFn: async (payload: { key: string; isActive?: boolean; cooldownHours?: number }) => {
      await api.patch(`/admin/notifications/campaigns/${payload.key}`, {
        isActive: payload.isActive,
        cooldownHours: payload.cooldownHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-overview'] });
      message.success('Кампания обновлена');
    },
    onError: () => message.error('Не удалось обновить кампанию'),
  });

  const runCampaign = useMutation({
    mutationFn: async (campaignKey?: string) => {
      await api.post('/admin/notifications/run', { campaignKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-logs'] });
      message.success('Запуск поставлен и выполнен');
    },
    onError: () => message.error('Не удалось запустить рассылку'),
  });

  const campaignColumns: ColumnsType<CampaignRow> = [
    {
      title: 'Кампания',
      render: (_: unknown, row) => (
        <div>
          <strong>{row.title}</strong>
          <div className="pg-notifications__muted">{row.key}</div>
        </div>
      ),
    },
    {
      title: 'Вкл',
      dataIndex: 'isActive',
      width: 76,
      render: (value: boolean, row) => (
        <Switch
          size="small"
          checked={value}
          onChange={(checked) => toggleCampaign.mutate({ key: row.key, isActive: checked })}
        />
      ),
    },
    {
      title: 'Аудитория',
      dataIndex: 'audience',
      width: 110,
      render: (value: number) => <Tag color={value > 0 ? 'blue' : 'default'}>{value}</Tag>,
    },
    {
      title: 'Sent / Failed',
      width: 130,
      render: (_: unknown, row) => (
        <Space size={4}>
          <Tag color="green">{row.sent}</Tag>
          <Tag color="red">{row.failed}</Tag>
        </Space>
      ),
    },
    {
      title: 'Cooldown',
      dataIndex: 'cooldownHours',
      width: 130,
      render: (value: number, row) => (
        <InputNumber
          min={1}
          max={720}
          size="small"
          value={value}
          addonAfter="ч"
          onPressEnter={(event) => {
            const next = Number((event.target as HTMLInputElement).value);
            if (Number.isFinite(next)) {
              toggleCampaign.mutate({ key: row.key, cooldownHours: next });
            }
          }}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next !== value) {
              toggleCampaign.mutate({ key: row.key, cooldownHours: next });
            }
          }}
        />
      ),
    },
    {
      title: 'Последняя попытка',
      dataIndex: 'lastAttemptedAt',
      width: 150,
      render: formatDate,
    },
    {
      title: '',
      width: 116,
      render: (_: unknown, row) => (
        <Button
          icon={<SendOutlined />}
          size="small"
          loading={runCampaign.isPending}
          onClick={() => runCampaign.mutate(row.key)}
        >
          Сейчас
        </Button>
      ),
    },
  ];

  const logColumns: ColumnsType<DeliveryLog> = [
    { title: 'Кампания', dataIndex: 'campaignKey', width: 190 },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 100,
      render: statusTag,
    },
    {
      title: 'Пользователь',
      render: (_: unknown, row) => (
        <div>
          <strong>{userLabel(row.user)}</strong>
          <div className="pg-notifications__muted">
            {row.user.telegramId ? row.user.telegramId : row.targetTelegramId}
          </div>
        </div>
      ),
    },
    {
      title: 'Язык',
      width: 76,
      render: (_: unknown, row) => row.user.preferredLanguage.toUpperCase(),
    },
    {
      title: 'Попытка',
      dataIndex: 'attemptedAt',
      width: 150,
      render: formatDate,
    },
    {
      title: 'Ошибка',
      width: 220,
      render: (_: unknown, row) =>
        row.errorMessage ? (
          <span title={row.errorMessage}>{row.errorCode || row.errorMessage}</span>
        ) : (
          '—'
        ),
    },
  ];

  const runColumns: ColumnsType<NotificationRun> = [
    { title: 'Источник', dataIndex: 'source', width: 110 },
    { title: 'Статус', dataIndex: 'status', width: 110, render: statusTag },
    { title: 'Scanned', dataIndex: 'scanned', width: 90 },
    { title: 'Sent', dataIndex: 'sent', width: 80 },
    { title: 'Skipped', dataIndex: 'skipped', width: 90 },
    { title: 'Failed', dataIndex: 'failed', width: 80 },
    { title: 'Старт', dataIndex: 'startedAt', width: 150, render: formatDate },
    {
      title: 'Ошибка',
      render: (_: unknown, row) =>
        row.errorMessage ? <span title={row.errorMessage}>{row.errorMessage}</span> : '—',
    },
  ];

  if (overviewPending && !overview) {
    return (
      <AdminPageShell wide className="admin-notifications-page">
        <Skeleton active paragraph={{ rows: 8 }} />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell wide className="admin-notifications-page">
      <div className="pg-notifications">
        <div className="pg-users__hero pg-dash__hero">
          <div>
            <p className="pg-dash__eyebrow">
              <BellOutlined /> Lifecycle Telegram
            </p>
            <h1 className="pg-dash__headline">Рассылки</h1>
            <p className="pg-dash__lede">
              Автоматические мягкие напоминания по воронке: канал, первый пробный тест, брошенные сессии и paid-retention.
            </p>
          </div>
          <div className="pg-notifications__settings">
            <Tag color={overview?.settings.enabled ? 'green' : 'red'}>
              {overview?.settings.enabled ? 'enabled' : 'disabled'}
            </Tag>
            <Tag>poll {overview?.settings.pollIntervalMinutes ?? 15} min</Tag>
            <Tag>batch {overview?.settings.batchSize ?? 50}</Tag>
            <Tag>quiet {overview?.settings.quietHours ?? '22-09'}</Tag>
          </div>
        </div>

        <HigTableCard>
          <Table
            rowKey="key"
            columns={campaignColumns}
            dataSource={overview?.campaigns ?? []}
            pagination={false}
            locale={{ emptyText: <Empty description="Кампаний пока нет" /> }}
          />
        </HigTableCard>

        <HigTableCard>
          <Table
            rowKey="id"
            columns={runColumns}
            dataSource={overview?.runs ?? []}
            pagination={false}
            locale={{ emptyText: <Empty description="Запусков пока нет" /> }}
          />
        </HigTableCard>

        <div className="pg-notifications__toolbar">
          <Space wrap>
            <Select
              allowClear
              placeholder="Кампания"
              value={campaignFilter}
              options={campaignOptions}
              style={{ minWidth: 220 }}
              onChange={(value) => {
                setCampaignFilter(value);
                setPage(1);
              }}
            />
            <Select
              allowClear
              placeholder="Статус"
              value={statusFilter}
              style={{ width: 140 }}
              options={[
                { value: 'sent', label: 'sent' },
                { value: 'failed', label: 'failed' },
                { value: 'pending', label: 'pending' },
              ]}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['admin-notifications-overview'] });
                queryClient.invalidateQueries({ queryKey: ['admin-notifications-logs'] });
              }}
            >
              Обновить
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={runCampaign.isPending}
              onClick={() => runCampaign.mutate(undefined)}
            >
              Запустить все
            </Button>
          </Space>
        </div>

        <HigTableCard>
          <Table
            rowKey="id"
            columns={logColumns}
            dataSource={logs?.items ?? []}
            loading={logsFetching}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: logs?.total ?? 0,
              onChange: setPage,
              showSizeChanger: false,
            }}
            locale={{ emptyText: <Empty description="Логов пока нет" /> }}
          />
        </HigTableCard>
      </div>
    </AdminPageShell>
  );
}
