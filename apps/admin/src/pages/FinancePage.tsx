import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Input, Select, Skeleton, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CreditCardOutlined,
  DollarOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';

type FinanceOrder = {
  id: string;
  planCode: string;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  status: 'created' | 'pending' | 'paid' | 'failed' | 'cancelled';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    telegramUsername: string | null;
    phone: string | null;
    email: string | null;
  };
  linkedSubscription: {
    id: string;
    isActive: boolean;
    startsAt: string;
    expiresAt: string;
    createdAt: string;
  } | null;
};

type FinanceResponse = {
  items: FinanceOrder[];
  total: number;
  page: number;
  limit: number;
  providers: string[];
  summary: {
    totalOrders: number;
    paidOrders: number;
    grossRevenueKzt: number;
    averagePaidCheckKzt: number;
    paidTodayKzt: number;
    statusCounts: Record<string, number>;
  };
};

const PAGE_SIZE = 25;

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: number, currency = 'KZT') {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusTag(status: FinanceOrder['status']) {
  switch (status) {
    case 'paid':
      return <Tag color="success" icon={<CheckCircleOutlined />}>Оплачен</Tag>;
    case 'pending':
      return <Tag color="processing" icon={<ClockCircleOutlined />}>Ожидает</Tag>;
    case 'created':
      return <Tag color="default" icon={<ClockCircleOutlined />}>Создан</Tag>;
    case 'cancelled':
      return <Tag color="warning" icon={<StopOutlined />}>Отменён</Tag>;
    case 'failed':
      return <Tag color="error" icon={<CloseCircleOutlined />}>Ошибка</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
}

export function FinancePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | FinanceOrder['status']>('all');
  const [provider, setProvider] = useState<string>('all');

  const { data, isPending, isFetching } = useQuery<FinanceResponse>({
    queryKey: ['admin-finance-orders', search, page, status, provider],
    queryFn: async () => {
      const { data } = await api.get<FinanceResponse>('/admin/finance/orders', {
        params: {
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
          status,
          provider,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const providers = useMemo(
    () => ['all', ...(data?.providers ?? [])].map((value) => ({ value, label: value === 'all' ? 'Все провайдеры' : value })),
    [data?.providers],
  );

  const columns: ColumnsType<FinanceOrder> = [
    {
      title: 'Пользователь',
      key: 'user',
      width: 320,
      render: (_value, record) => (
        <div className="pg-finance__user">
          <div className="pg-finance__user-main">
            <Link to={`/users/${record.user.id}`}>{record.user.displayName}</Link>
          </div>
          <div className="pg-finance__user-sub">
            {record.user.telegramUsername ? `@${record.user.telegramUsername}` : record.user.phone ? `+${record.user.phone}` : record.user.email || '—'}
          </div>
          <div className="pg-finance__user-actions">
            <Link to={`/users/${record.user.id}`}>
              <Button type="link" size="small" icon={<ArrowRightOutlined />}>
                Открыть профиль
              </Button>
            </Link>
          </div>
        </div>
      ),
    },
    {
      title: 'Тариф',
      dataIndex: 'planCode',
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      width: 120,
      render: (value: number, record) => <strong>{formatMoney(value, record.currency)}</strong>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 130,
      render: (value: FinanceOrder['status']) => statusTag(value),
    },
    {
      title: 'Провайдер',
      dataIndex: 'provider',
      width: 120,
    },
    {
      title: 'Оплачен / создан',
      key: 'dates',
      width: 180,
      render: (_value, record) => (
        <div className="pg-finance__dates">
          <div>{formatDateTime(record.paidAt)}</div>
          <small>создан {formatDateTime(record.createdAt)}</small>
        </div>
      ),
    },
    {
      title: 'Подписка',
      key: 'subscription',
      width: 220,
      render: (_value, record) =>
        record.linkedSubscription ? (
          <div className="pg-finance__subscription">
            <Tag color={record.linkedSubscription.isActive ? 'green' : 'default'}>
              {record.linkedSubscription.isActive ? 'Активна' : 'Выдана'}
            </Tag>
            <small>до {formatDateTime(record.linkedSubscription.expiresAt)}</small>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: 'Платёж',
      key: 'providerOrderId',
      width: 260,
      render: (_value, record) => (
        <div className="pg-finance__provider">
          <code>{record.providerOrderId}</code>
          {record.providerPaymentId ? <small>payment: {record.providerPaymentId}</small> : null}
          {record.checkoutUrl ? (
            <a href={record.checkoutUrl} target="_blank" rel="noreferrer">
              Открыть checkout <LinkOutlined />
            </a>
          ) : null}
        </div>
      ),
    },
  ];

  if (isPending && !data) {
    return (
      <AdminPageShell>
        <div className="pg-finance">
          <Skeleton active className="pg-users__skeleton-hero" paragraph={{ rows: 0 }} />
          <div className="pg-users__stat-strip">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton.Button key={i} active block style={{ height: 88, borderRadius: 16 }} />
            ))}
          </div>
          <Skeleton active paragraph={{ rows: 2 }} className="pg-users__skeleton-search" />
          <Skeleton active paragraph={false} className="pg-users__skeleton-table" />
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell wide>
      <div className="pg-finance">
        <div className="pg-finance__hero pg-dash__hero">
          <div>
            <p className="pg-dash__eyebrow">
              <CreditCardOutlined /> Денежный поток
            </p>
            <h1 className="pg-dash__headline">Финансы и покупки</h1>
            <p className="pg-dash__lede">
              Быстрый срез по оплатам, статусам заказов и тому, была ли по платежу фактически выдана подписка.
            </p>
          </div>
          <div className="pg-dash__hero-aside">
            <div className="pg-dash__date">{formatNowRu()}</div>
            <div className="pg-dash__pill pg-dash__pill--sync">
              {isFetching ? 'Обновляем данные…' : 'Живые данные по заказам'}
            </div>
          </div>
        </div>

        <div className="pg-users__stat-strip">
          <article className="pg-users__stat pg-users__stat--blue">
            <div className="pg-users__stat-icon">
              <DollarOutlined />
            </div>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Выручка</span>
              <strong className="pg-users__stat-v">{formatMoney(data?.summary.grossRevenueKzt ?? 0)}</strong>
            </div>
          </article>
          <article className="pg-users__stat pg-users__stat--violet">
            <div className="pg-users__stat-icon">
              <CheckCircleOutlined />
            </div>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Оплачено</span>
              <strong className="pg-users__stat-v">{data?.summary.paidOrders ?? 0}</strong>
            </div>
          </article>
          <article className="pg-users__stat pg-users__stat--teal">
            <div className="pg-users__stat-icon">
              <CreditCardOutlined />
            </div>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Сегодня</span>
              <strong className="pg-users__stat-v">{formatMoney(data?.summary.paidTodayKzt ?? 0)}</strong>
            </div>
          </article>
          <article className="pg-users__stat pg-users__stat--amber">
            <div className="pg-users__stat-icon">
              <DollarOutlined />
            </div>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Средний чек</span>
              <strong className="pg-users__stat-v">{formatMoney(data?.summary.averagePaidCheckKzt ?? 0)}</strong>
            </div>
          </article>
        </div>

        <div className="pg-users__search-card pg-users__search-card--accent">
          <div className="pg-users__search-head">
            <div>
              <strong>Поиск заказов</strong>
              <div className="pg-users__search-hint">
                Username, телефон, тариф, provider order id, статус оплаты.
              </div>
            </div>
          </div>
          <Space wrap className="pg-finance__filters">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Найти заказ или пользователя"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ minWidth: 280 }}
            />
            <Select
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Все статусы' },
                { value: 'paid', label: 'paid' },
                { value: 'pending', label: 'pending' },
                { value: 'created', label: 'created' },
                { value: 'cancelled', label: 'cancelled' },
                { value: 'failed', label: 'failed' },
              ]}
              style={{ minWidth: 180 }}
            />
            <Select
              value={provider}
              onChange={(value) => {
                setProvider(value);
                setPage(1);
              }}
              options={providers}
              style={{ minWidth: 180 }}
            />
            <Button onClick={() => setPage(1)}>Обновить</Button>
          </Space>
          <div className="pg-finance__status-line">
            <span>Всего: {data?.summary.totalOrders ?? 0}</span>
            <span>Pending: {data?.summary.statusCounts.pending ?? 0}</span>
            <span>Cancelled: {data?.summary.statusCounts.cancelled ?? 0}</span>
            <span>Failed: {data?.summary.statusCounts.failed ?? 0}</span>
          </div>
        </div>

        <HigTableCard className="pg-finance__table-card" bordered>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={isFetching}
            pagination={{
              current: data?.page ?? 1,
              pageSize: data?.limit ?? PAGE_SIZE,
              total: data?.total ?? 0,
              onChange: (next) => setPage(next),
              showSizeChanger: false,
            }}
            scroll={{ x: 1400 }}
          />
        </HigTableCard>
      </div>
    </AdminPageShell>
  );
}
