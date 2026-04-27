import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Table, Input, Tag, Switch, message, Empty, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  TeamOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  TableOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';

interface User {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: string;
  isChannelMember: boolean;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
  entitlements?: Array<{
    id: string;
    examTypeId: string;
    tier: string;
    status: string;
    totalAttemptsLimit: number | null;
    usedAttemptsTotal: number;
    dailyAttemptsLimit: number | null;
    nextAllowedAt: string | null;
    examType?: { slug: string };
  }>;
  createdAt: string;
}

const PAGE_SIZE = 20;

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { search: search || undefined, page, limit: PAGE_SIZE },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items: User[] = data?.items ?? [];
  const premiumOnPage = useMemo(
    () => items.filter((u) => u.hasActiveSubscription).length,
    [items],
  );

  const showSkeleton = isPending && !data;

  const toggleAdmin = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      await api.patch(`/admin/users/${id}`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success('Обновлено');
    },
  });

  const columns: ColumnsType<User> = [
    {
      title: 'Telegram ID',
      dataIndex: 'telegramId',
      width: 120,
      className: 'pg-users__cell-mono',
    },
    {
      title: 'Username',
      dataIndex: 'telegramUsername',
      render: (v: string | null) => v ? `@${v}` : '—',
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      width: 140,
      render: (v: string | null) => (v ? `+${v}` : '—'),
    },
    {
      title: 'Имя',
      render: (_: unknown, record: User) => `${record.firstName || ''} ${record.lastName || ''}`.trim() || '—',
    },
    {
      title: 'Язык',
      dataIndex: 'preferredLanguage',
      width: 80,
      render: (v: string) => v.toUpperCase(),
    },
    {
      title: 'Канал',
      dataIndex: 'isChannelMember',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Premium',
      dataIndex: 'hasActiveSubscription',
      width: 100,
      render: (v: boolean) => (v ? <Tag color="gold">Да</Tag> : <Tag>—</Tag>),
    },
    {
      title: 'Доступ (v2)',
      width: 260,
      render: (_: unknown, record: User) => {
        if (!record.entitlements || record.entitlements.length === 0) return '—';
        const items = record.entitlements.slice(0, 2);
        return (
          <div className="pg-users__ent-col">
            {items.map((ent) => {
              const remaining =
                ent.totalAttemptsLimit == null
                  ? '∞'
                  : `${Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal)}/${ent.totalAttemptsLimit}`;
              const day = ent.dailyAttemptsLimit == null ? '∞' : String(ent.dailyAttemptsLimit);
              return (
                <div key={ent.id} className="pg-users__ent-line">
                  <Tag color={ent.status === 'active' ? 'green' : 'default'}>
                    {(ent.examType?.slug ?? 'exam').toUpperCase()}
                  </Tag>
                  <span>
                    {remaining} · day {day}
                    {ent.nextAllowedAt ? ` · next ${new Date(ent.nextAllowedAt).toLocaleString()}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Админ',
      dataIndex: 'isAdmin',
      width: 80,
      render: (v: boolean, record: User) => (
        <Switch
          checked={v}
          onChange={(checked) => toggleAdmin.mutate({ id: record.id, isAdmin: checked })}
          size="small"
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: User) => (
        <a onClick={() => navigate(`/users/${record.id}`)}>Открыть</a>
      ),
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
  ];

  if (showSkeleton) {
    return (
      <AdminPageShell>
        <div className="pg-users">
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
    <AdminPageShell>
      <div className="pg-users">
        <div className="pg-users__hero pg-dash__hero">
          <div>
            <p className="pg-dash__eyebrow">
              <TeamOutlined /> Каталог аккаунтов
            </p>
            <h1 className="pg-dash__headline">Пользователи</h1>
            <p className="pg-dash__lede">
              Telegram, телефон, подписка и v2-доступ по экзаменам. Переключатель «Админ» даёт право заходить в эту
              панель — используйте осторожно.
            </p>
          </div>
          <div className="pg-dash__hero-aside">
            <span className="pg-dash__date">{formatNowRu()}</span>
            <span className={isFetching ? 'pg-dash__pill pg-dash__pill--sync' : 'pg-dash__pill'}>
              {isFetching ? (
                <>
                  <ThunderboltOutlined /> Обновление…
                </>
              ) : (
                'Данные на момент загрузки'
              )}
            </span>
          </div>
        </div>

        <div className="pg-users__stat-strip">
          <div className="pg-users__stat pg-users__stat--blue">
            <span className="pg-users__stat-icon">
              <TeamOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Всего в базе</span>
              <span className="pg-users__stat-v">{total.toLocaleString('ru-RU')}</span>
            </div>
          </div>
          <div className="pg-users__stat pg-users__stat--violet">
            <span className="pg-users__stat-icon">
              <UnorderedListOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">На этой странице</span>
              <span className="pg-users__stat-v">{items.length}</span>
            </div>
          </div>
          <div className="pg-users__stat pg-users__stat--teal">
            <span className="pg-users__stat-icon">
              <TableOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Номер страницы</span>
              <span className="pg-users__stat-v">
                {page} / {pageCount}
              </span>
            </div>
          </div>
          <div className="pg-users__stat pg-users__stat--amber">
            <span className="pg-users__stat-icon">
              <CrownOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Premium на странице</span>
              <span className="pg-users__stat-v">{premiumOnPage}</span>
            </div>
          </div>
        </div>

        <div className="pg-users__search-card pg-users__search-card--accent">
          <div className="pg-users__search-head">
            <div className="pg-users__meta">
              <span className="pg-users__label">
                <SearchOutlined /> Поиск
              </span>
              <span className="pg-users__chip">{total.toLocaleString('ru-RU')} в базе</span>
            </div>
            <p className="pg-users__search-hint">Точное совпадение не обязательно: подойдут фрагменты имени и телефона.</p>
          </div>
          <div className="pg-users__search-row">
            <Input.Search
              className="pg-users__search"
              placeholder="@username, имя или фрагмент телефона"
              allowClear
              enterButton="Найти"
              size="large"
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </div>
        </div>

        <HigTableCard className="pg-users__table-card">
          <Table
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={isFetching}
            pagination={{
              current: page,
              total,
              pageSize: PAGE_SIZE,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (n) => `${n.toLocaleString('ru-RU')} записей`,
            }}
            size="small"
            scroll={{ x: 960 }}
            locale={{ emptyText: <Empty description="Нет данных по запросу" /> }}
          />
        </HigTableCard>
      </div>
    </AdminPageShell>
  );
}
