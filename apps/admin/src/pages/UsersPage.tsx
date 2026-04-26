import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Input, Tag, Switch, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { AdminPageToolbar } from '../components/AdminPageToolbar';

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

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { search: search || undefined, page, limit: 20 },
      });
      return data;
    },
  });

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((ent) => {
              const remaining =
                ent.totalAttemptsLimit == null
                  ? '∞'
                  : `${Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal)}/${ent.totalAttemptsLimit}`;
              const day = ent.dailyAttemptsLimit == null ? '∞' : String(ent.dailyAttemptsLimit);
              return (
                <div key={ent.id} style={{ fontSize: 12 }}>
                  <Tag color={ent.status === 'active' ? 'green' : 'default'}>
                    {(ent.examType?.slug ?? 'exam').toUpperCase()}
                  </Tag>
                  {remaining} · day {day}
                  {ent.nextAllowedAt ? ` · next ${new Date(ent.nextAllowedAt).toLocaleString()}` : ''}
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
      title: 'Дата регистрации',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <AdminPageToolbar
        end={<Tag>Записей: {data?.total ?? 0}</Tag>}
      >
        <Input.Search
          placeholder="Поиск: @username, имя"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); }}
          style={{ width: 280, maxWidth: '100%' }}
        />
      </AdminPageToolbar>

      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          total: data?.total || 0,
          pageSize: 20,
          onChange: setPage,
          showTotal: (total) => `Всего: ${total}`,
        }}
        size="middle"
        scroll={{ x: 800 }}
        locale={{ emptyText: <Empty description="Пользователи не найдены" /> }}
      />
    </div>
  );
}
