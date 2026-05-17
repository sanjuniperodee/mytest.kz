import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Empty,
  Input,
  Progress,
  Segmented,
  Select,
  message,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CrownOutlined,
  DeleteOutlined,
  FilterOutlined,
  ReloadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';

interface User {
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

type PremiumFilter = 'all' | 'premium' | 'no-premium';
type RoleFilter = 'all' | 'admin' | 'user';
type ChannelFilter = 'all' | 'member' | 'non-member';
type LanguageFilter = 'all' | 'ru' | 'kk' | 'en';

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function normalizePhone(phone: string | null) {
  if (!phone) return '—';
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function getFullName(user: User) {
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (full) return full;
  if (user.telegramUsername) return `@${user.telegramUsername}`;
  if (user.email) return user.email;
  if (user.phone) return normalizePhone(user.phone);
  return `ID ${user.id.slice(0, 8)}`;
}

function languageLabel(code: string) {
  const normalized = (code || '').toLowerCase();
  if (normalized === 'kk') return 'ҚАЗ';
  if (normalized === 'en') return 'ENG';
  return 'РУС';
}

function hasNextAllowedAt(entitlements?: User['entitlements']) {
  return Boolean(entitlements?.some((ent) => Boolean(ent.nextAllowedAt)));
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');

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
  const filteredItems = useMemo(() => {
    return items.filter((user) => {
      if (premiumFilter === 'premium' && !user.hasActiveSubscription) return false;
      if (premiumFilter === 'no-premium' && user.hasActiveSubscription) return false;

      if (roleFilter === 'admin' && !user.isAdmin) return false;
      if (roleFilter === 'user' && user.isAdmin) return false;

      if (channelFilter === 'member' && !user.isChannelMember) return false;
      if (channelFilter === 'non-member' && user.isChannelMember) return false;

      if (languageFilter !== 'all' && user.preferredLanguage.toLowerCase() !== languageFilter) return false;

      return true;
    });
  }, [items, premiumFilter, roleFilter, channelFilter, languageFilter]);

  const stats = useMemo(() => {
    const premium = filteredItems.filter((u) => u.hasActiveSubscription).length;
    const admins = filteredItems.filter((u) => u.isAdmin).length;
    const withCooldown = filteredItems.filter((u) => hasNextAllowedAt(u.entitlements)).length;
    return {
      shown: filteredItems.length,
      premium,
      admins,
      withCooldown,
    };
  }, [filteredItems]);

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

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      if (items.length <= 1 && page > 1) {
        setPage((cur) => Math.max(1, cur - 1));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Пользователь удалён');
    },
    onError: () => {
      message.error('Не удалось удалить пользователя');
    },
  });

  const columns: ColumnsType<User> = [
    {
      title: 'Пользователь',
      key: 'user',
      width: 340,
      render: (_: unknown, record: User) => {
        const name = getFullName(record);
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('') || 'U';

        return (
          <div className="pg-users__person">
            <Avatar size={40} className="pg-users__person-avatar">
              {initials}
            </Avatar>
            <div className="pg-users__person-body">
              <div className="pg-users__person-name-row">
                <strong>{name}</strong>
                {record.isAdmin ? <Tag color="geekblue">ADMIN</Tag> : null}
              </div>
              <span className="pg-users__person-sub">
                {record.telegramUsername ? `@${record.telegramUsername}` : record.email || normalizePhone(record.phone)}
              </span>
              <span className="pg-users__person-sub pg-users__cell-mono">
                TG: {record.telegramId ?? '—'} · ID: {record.id.slice(0, 8)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Статусы',
      key: 'status',
      width: 260,
      render: (_: unknown, record: User) => (
        <div className="pg-users__status-grid">
          <Tag color={record.hasActiveSubscription ? 'gold' : 'default'}>
            {record.hasActiveSubscription ? 'Premium' : 'Без подписки'}
          </Tag>
          <Tag color={record.isChannelMember ? 'green' : 'default'}>
            {record.isChannelMember ? 'Канал: да' : 'Канал: нет'}
          </Tag>
          <Tag color="blue">{languageLabel(record.preferredLanguage)}</Tag>
          <Tag>{normalizePhone(record.phone)}</Tag>
        </div>
      ),
    },
    {
      title: 'Доступ (v2)',
      width: 330,
      render: (_: unknown, record: User) => {
        if (!record.entitlements || record.entitlements.length === 0) return '—';
        const entitlementItems = record.entitlements.slice(0, 3);
        return (
          <div className="pg-users__ent-stack">
            {entitlementItems.map((ent) => {
              const remaining =
                ent.totalAttemptsLimit == null
                  ? '∞'
                  : `${Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal)}/${ent.totalAttemptsLimit}`;
              const daily =
                ent.dailyAttemptsLimit == null ? 'без лимита/день' : `${ent.dailyAttemptsLimit}/день`;
              const progressPercent =
                ent.totalAttemptsLimit == null || ent.totalAttemptsLimit <= 0
                  ? 0
                  : Math.min(100, Math.round((ent.usedAttemptsTotal / ent.totalAttemptsLimit) * 100));

              return (
                <div key={ent.id} className="pg-users__ent-card">
                  <div className="pg-users__ent-card-head">
                    <Tag color={ent.status === 'active' ? 'green' : 'default'}>
                      {(ent.examType?.slug ?? 'exam').toUpperCase()}
                    </Tag>
                    <span className="pg-users__ent-meta">
                      {remaining} · {daily}
                    </span>
                  </div>
                  {ent.totalAttemptsLimit != null ? (
                    <Progress
                      percent={progressPercent}
                      size={[120, 6]}
                      showInfo={false}
                      strokeColor={ent.status === 'active' ? '#1677ff' : '#8c8c8c'}
                    />
                  ) : (
                    <span className="pg-users__ent-unlimited">Безлимитный доступ</span>
                  )}
                  {ent.nextAllowedAt ? (
                    <span className="pg-users__ent-next">
                      Следующая попытка: {new Date(ent.nextAllowedAt).toLocaleString('ru-RU')}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Регистрация',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => (
        <Tooltip title={new Date(v).toLocaleString('ru-RU')}>
          <span>{new Date(v).toLocaleDateString('ru-RU')}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: User) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => navigate(`/users/${record.id}`)}>
            Профиль
          </Button>
          <Switch
            checked={record.isAdmin}
            onChange={(checked) => toggleAdmin.mutate({ id: record.id, isAdmin: checked })}
            size="small"
            checkedChildren="A"
            unCheckedChildren="U"
          />
          <Popconfirm
            title="Удалить пользователя?"
            description="Аккаунт, сессии, ответы, подписки, доступы и платежные заказы будут удалены."
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: deleteUser.isPending }}
            onConfirm={() => deleteUser.mutate(record.id)}
          >
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteUser.isPending}
            />
          </Popconfirm>
        </Space>
      ),
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
              Оперативный контроль аккаунтов, ролей, подписки и ограничений доступа. Все критичные действия доступны из
              одной таблицы.
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
              <TableOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Показано после фильтров</span>
              <span className="pg-users__stat-v">{stats.shown}</span>
            </div>
          </div>
          <div className="pg-users__stat pg-users__stat--teal">
            <span className="pg-users__stat-icon">
              <CrownOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Premium в выборке</span>
              <span className="pg-users__stat-v">{stats.premium}</span>
            </div>
          </div>
          <div className="pg-users__stat pg-users__stat--amber">
            <span className="pg-users__stat-icon">
              <SafetyCertificateOutlined />
            </span>
            <div className="pg-users__stat-body">
              <span className="pg-users__stat-k">Админы / кулдаун</span>
              <span className="pg-users__stat-v">
                {stats.admins} / {stats.withCooldown}
              </span>
            </div>
          </div>
        </div>

        <div className="pg-users__search-card pg-users__search-card--accent pg-users__toolbar-card">
          <div className="pg-users__toolbar-head">
            <div className="pg-users__search-head">
              <div className="pg-users__meta">
                <span className="pg-users__label">
                  <SearchOutlined /> Поиск и фильтры
                </span>
                <span className="pg-users__chip">{total.toLocaleString('ru-RU')} в базе</span>
              </div>
              <p className="pg-users__search-hint">
                Поиск идёт по username, email, телефону и имени. Фильтры ниже применяются к текущей странице.
              </p>
            </div>
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
              >
                Обновить
              </Button>
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setPremiumFilter('all');
                  setRoleFilter('all');
                  setChannelFilter('all');
                  setLanguageFilter('all');
                }}
              >
                Сбросить фильтры
              </Button>
            </Space>
          </div>

          <div className="pg-users__search-row">
            <Input.Search
              className="pg-users__search"
              placeholder="@username, имя или фрагмент телефона"
              allowClear
              enterButton="Найти"
              size="large"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onSearch={(value) => {
                setSearch(value.trim());
                setPage(1);
              }}
            />
          </div>

          <div className="pg-users__filters-grid">
            <div className="pg-users__filter-block">
              <span className="pg-users__filter-label">
                <CrownOutlined /> Подписка
              </span>
              <Segmented
                value={premiumFilter}
                options={[
                  { label: 'Все', value: 'all' },
                  { label: 'Premium', value: 'premium' },
                  { label: 'Без Premium', value: 'no-premium' },
                ]}
                onChange={(value) => setPremiumFilter(value as PremiumFilter)}
              />
            </div>
            <div className="pg-users__filter-block">
              <span className="pg-users__filter-label">
                <SafetyCertificateOutlined /> Роль
              </span>
              <Segmented
                value={roleFilter}
                options={[
                  { label: 'Все', value: 'all' },
                  { label: 'Админы', value: 'admin' },
                  { label: 'Пользователи', value: 'user' },
                ]}
                onChange={(value) => setRoleFilter(value as RoleFilter)}
              />
            </div>
            <div className="pg-users__filter-block">
              <span className="pg-users__filter-label">
                <CheckCircleOutlined /> Канал
              </span>
              <Segmented
                value={channelFilter}
                options={[
                  { label: 'Все', value: 'all' },
                  { label: 'Подписан', value: 'member' },
                  { label: 'Не подписан', value: 'non-member' },
                ]}
                onChange={(value) => setChannelFilter(value as ChannelFilter)}
              />
            </div>
            <div className="pg-users__filter-block">
              <span className="pg-users__filter-label">
                <UserOutlined /> Язык
              </span>
              <Select
                value={languageFilter}
                onChange={(value) => setLanguageFilter(value as LanguageFilter)}
                options={[
                  { label: 'Все языки', value: 'all' },
                  { label: 'Русский', value: 'ru' },
                  { label: 'Қазақша', value: 'kk' },
                  { label: 'English', value: 'en' },
                ]}
              />
            </div>
          </div>
        </div>

        <HigTableCard className="pg-users__table-card">
          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey="id"
            loading={isFetching}
            rowClassName={(record) => (record.isAdmin ? 'pg-users__row-admin' : '')}
            pagination={{
              current: page,
              total,
              pageSize: PAGE_SIZE,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (n) => `${n.toLocaleString('ru-RU')} записей`,
            }}
            size="small"
            scroll={{ x: 1240 }}
            locale={{
              emptyText: (
                <Empty
                  description="Ничего не найдено"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    onClick={() => {
                      setPremiumFilter('all');
                      setRoleFilter('all');
                      setChannelFilter('all');
                      setLanguageFilter('all');
                    }}
                  >
                    Сбросить фильтры
                  </Button>
                </Empty>
              ),
            }}
          />
        </HigTableCard>
        <p className="pg-users__footnote">
          Страница {page} из {pageCount}. Фильтры применяются к текущей странице (серверная пагинация активна).
        </p>
      </div>
    </AdminPageShell>
  );
}
