import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Select, DatePicker, Input, message, Tag, Alert, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [userSearch, setUserSearch] = useState('');

  // Fetch users for the dropdown
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-list', userSearch],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', {
        params: { search: userSearch, limit: 50 },
      });
      return data;
    },
  });

  const { data: examTypes } = useQuery({
    queryKey: ['exam-types'],
    queryFn: async () => (await api.get('/exams/types')).data,
  });

  // We don't have a dedicated admin subscriptions list endpoint,
  // but we can search users with subscriptions
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-with-subs'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { limit: 100 } });
      return data;
    },
  });

  const grantSubscription = useMutation({
    mutationFn: async (values: any) => {
      await api.post('/admin/subscriptions', {
        userId: values.userId,
        planType: values.planType,
        examTypeId: values.examTypeId || undefined,
        startsAt: values.dateRange[0].toISOString(),
        expiresAt: values.dateRange[1].toISOString(),
        paymentNote: values.paymentNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Подписка выдана');
    },
    onError: () => message.error('Ошибка'),
  });

  // Show users with subscription info
  const usersWithSubs = (users?.items || []).filter((u: any) => u.hasActiveSubscription);

  const columns: ColumnsType<any> = [
    {
      title: 'Пользователь',
      render: (_: unknown, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.firstName} {record.lastName}</div>
          <div style={{ color: '#999', fontSize: 12 }}>@{record.telegramUsername || record.telegramId}</div>
        </div>
      ),
    },
    {
      title: 'Статус',
      render: (_: unknown, record: any) =>
        record.hasActiveSubscription
          ? <Tag color="gold">Premium</Tag>
          : <Tag>Нет</Tag>,
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Подписки ({usersWithSubs.length} активных)</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Выдать подписку
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="В таблице отображаются только пользователи с активной подпиской"
      />

      <Table
        columns={columns}
        dataSource={usersWithSubs}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Активных подписок пока нет" /> }}
      />

      <Modal
        title="Выдать подписку"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={grantSubscription.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => grantSubscription.mutate(v)}>
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Поиск по username"
              onSearch={setUserSearch}
              filterOption={false}
              options={usersData?.items?.map((u: any) => ({
                value: u.id,
                label: `${u.firstName || ''} ${u.lastName || ''} (@${u.telegramUsername || u.telegramId})`,
              }))}
            />
          </Form.Item>

          <Form.Item name="planType" label="Тип подписки" rules={[{ required: true }]} initialValue="monthly">
            <Select options={[
              { value: 'monthly', label: 'Месяц' },
              { value: 'yearly', label: 'Год' },
              { value: 'exam_specific', label: 'На конкретный экзамен' },
            ]} />
          </Form.Item>

          <Form.Item name="examTypeId" label="Экзамен (если конкретный)">
            <Select
              allowClear
              placeholder="Все экзамены"
              options={examTypes?.map((e: any) => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>

          <Form.Item name="dateRange" label="Период" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="paymentNote" label="Заметка об оплате">
            <Input.TextArea rows={2} placeholder="Например: Kaspi перевод 5000 тг" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
