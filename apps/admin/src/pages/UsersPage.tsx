import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Input, Tag, Switch, Space, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

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
      render: (v: boolean) => v ? <Tag color="gold">Active</Tag> : <Tag>—</Tag>,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Пользователи</h2>
        <Tag color="blue">Всего: {data?.total || 0}</Tag>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Поиск по username или имени"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); }}
          style={{ width: 300 }}
        />
      </Space>

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
