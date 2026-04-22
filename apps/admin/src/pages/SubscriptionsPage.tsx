import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

const PLAN_TYPES = [
  { value: 'trial', label: 'Пробный (1 тест, 24ч)' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'annual', label: 'Год' },
];

const ENTITLEMENT_TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'trial', label: 'Trial' },
  { value: 'paid', label: 'Paid' },
  { value: 'admin', label: 'Admin' },
];

const ENTITLEMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'exhausted', label: 'Exhausted' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
];

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [selectedEntitlementsUserId, setSelectedEntitlementsUserId] = useState<string | null>(
    null,
  );
  const [userSearch, setUserSearch] = useState('');
  const [subscriptionForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [entitlementForm] = Form.useForm();

  const { data: usersData } = useQuery({
    queryKey: ['admin-users-list', userSearch],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { search: userSearch, limit: 100 } });
      return data;
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-with-subs'],
    queryFn: async () => (await api.get('/admin/users', { params: { limit: 200 } })).data,
  });

  const { data: examTypes } = useQuery({
    queryKey: ['exam-types'],
    queryFn: async () => (await api.get('/exams/types')).data,
  });

  const { data: planTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin-plan-templates'],
    queryFn: async () => (await api.get('/admin/subscriptions/plan-templates')).data,
  });

  const { data: entitlements, isLoading: entitlementsLoading } = useQuery({
    queryKey: ['admin-user-entitlements', selectedEntitlementsUserId],
    enabled: !!selectedEntitlementsUserId,
    queryFn: async () =>
      (await api.get(`/admin/subscriptions/users/${selectedEntitlementsUserId}/entitlements`))
        .data,
  });

  const usersOptions = useMemo(
    () =>
      (usersData?.items ?? []).map((u: any) => ({
        value: u.id,
        label: `${u.firstName || ''} ${u.lastName || ''} (@${u.telegramUsername || u.telegramId})`,
      })),
    [usersData],
  );

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
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-subs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      setSubscriptionModalOpen(false);
      subscriptionForm.resetFields();
      message.success('Подписка выдана');
    },
    onError: () => message.error('Ошибка при выдаче подписки'),
  });

  const createPlanTemplate = useMutation({
    mutationFn: async (values: any) => {
      await api.post('/admin/subscriptions/plan-templates', {
        code: values.code,
        name: values.name,
        description: values.description || null,
        isPremium: !!values.isPremium,
        durationDays: values.durationDays ?? null,
        totalAttemptsLimit: values.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: values.dailyAttemptsLimit ?? null,
        rules: values.rules ?? [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-templates'] });
      setTemplateModalOpen(false);
      templateForm.resetFields();
      message.success('Шаблон тарифа создан');
    },
    onError: () => message.error('Ошибка при создании шаблона'),
  });

  const grantEntitlement = useMutation({
    mutationFn: async (values: any) => {
      await api.post('/admin/subscriptions/entitlements', {
        userId: values.userId,
        examTypeId: values.examTypeId,
        tier: values.tier,
        status: values.status,
        totalAttemptsLimit: values.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: values.dailyAttemptsLimit ?? null,
        usedAttemptsTotal: values.usedAttemptsTotal ?? 0,
        timezone: values.timezone || undefined,
        windowStartsAt: values.dateRange[0].toISOString(),
        windowEndsAt: values.dateRange[1]?.toISOString() ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      setEntitlementModalOpen(false);
      entitlementForm.resetFields();
      message.success('Entitlement выдан');
    },
    onError: () => message.error('Ошибка при выдаче entitlement'),
  });

  const adjustAttempts = useMutation({
    mutationFn: async ({
      entitlementId,
      delta,
      reasonCode,
    }: {
      entitlementId: string;
      delta: number;
      reasonCode?: string;
    }) => {
      await api.post(`/admin/subscriptions/entitlements/${entitlementId}/adjust-attempts`, {
        delta,
        reasonCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Попытки скорректированы');
    },
    onError: () => message.error('Ошибка корректировки'),
  });

  const updateEntitlementStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/admin/subscriptions/entitlements/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Статус обновлён');
    },
    onError: () => message.error('Не удалось обновить статус'),
  });

  const revokeSubscription = useMutation({
    mutationFn: async (subId: string) => {
      await api.delete(`/admin/subscriptions/${subId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-subs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Подписка отозвана');
    },
    onError: () => message.error('Ошибка при отзыве'),
  });

  const usersWithSubs = (users?.items || []).filter((u: any) => u.subscriptions?.length > 0);

  const subscriptionColumns: ColumnsType<any> = [
    {
      title: 'Пользователь',
      render: (_: unknown, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.firstName} {record.lastName}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            @{record.telegramUsername || record.telegramId}
            {record.phone ? ` · +${record.phone}` : ''}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'План',
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        return sub ? <Tag>{sub.planType}</Tag> : '—';
      },
      width: 120,
    },
    {
      title: 'Действует до',
      width: 140,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        return sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('ru-RU') : '—';
      },
    },
    {
      title: 'Действия',
      width: 120,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        if (!sub) return null;
        return (
          <Popconfirm
            title="Отозвать подписку?"
            onConfirm={() => revokeSubscription.mutate(sub.id)}
            okText="Отозвать"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<StopOutlined />}>
              Отозвать
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const templateColumns: ColumnsType<any> = [
    { title: 'Code', dataIndex: 'code', width: 180 },
    { title: 'Название', dataIndex: 'name' },
    {
      title: 'Лимиты',
      render: (_: unknown, row: any) =>
        `total=${row.totalAttemptsLimit ?? '∞'} / day=${row.dailyAttemptsLimit ?? '∞'}`,
    },
    {
      title: 'Premium',
      dataIndex: 'isPremium',
      render: (v: boolean) => (v ? <Tag color="gold">yes</Tag> : <Tag>no</Tag>),
      width: 100,
    },
  ];

  const entitlementColumns: ColumnsType<any> = [
    {
      title: 'Exam',
      render: (_: unknown, row: any) => row.examType?.slug ?? row.examTypeId,
      width: 120,
    },
    { title: 'Tier', dataIndex: 'tier', width: 90 },
    {
      title: 'Status',
      width: 180,
      render: (_: unknown, row: any) => (
        <Select
          size="small"
          value={row.status}
          style={{ width: 150 }}
          options={ENTITLEMENT_STATUSES}
          onChange={(status) => updateEntitlementStatus.mutate({ id: row.id, status })}
        />
      ),
    },
    {
      title: 'Остаток',
      render: (_: unknown, row: any) => {
        if (row.totalAttemptsLimit == null) return '∞';
        return `${Math.max(0, row.totalAttemptsLimit - row.usedAttemptsTotal)}/${row.totalAttemptsLimit}`;
      },
      width: 120,
    },
    {
      title: 'Day',
      render: (_: unknown, row: any) => row.dailyAttemptsLimit ?? '∞',
      width: 90,
    },
    {
      title: 'Период',
      render: (_: unknown, row: any) =>
        `${new Date(row.windowStartsAt).toLocaleDateString('ru-RU')} → ${
          row.windowEndsAt ? new Date(row.windowEndsAt).toLocaleDateString('ru-RU') : '∞'
        }`,
    },
    {
      title: 'Корректировка',
      width: 260,
      render: (_: unknown, row: any) => (
        <Space>
          <Button size="small" onClick={() => adjustAttempts.mutate({ entitlementId: row.id, delta: -1 })}>
            -1
          </Button>
          <Button size="small" onClick={() => adjustAttempts.mutate({ entitlementId: row.id, delta: 1 })}>
            +1
          </Button>
          <Button size="small" onClick={() => adjustAttempts.mutate({ entitlementId: row.id, delta: -5 })}>
            -5
          </Button>
          <Button size="small" onClick={() => adjustAttempts.mutate({ entitlementId: row.id, delta: 5 })}>
            +5
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Subscription Engine v2</h2>
        <Space>
          <Button onClick={() => setTemplateModalOpen(true)}>Новый шаблон</Button>
          <Button onClick={() => setEntitlementModalOpen(true)}>Выдать entitlement</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubscriptionModalOpen(true)}>
            Выдать legacy подписку
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="В этой странице доступны: выдача legacy subscription, шаблоны тарифов v2, entitlement по экзаменам, ручная корректировка и статусные override."
      />

      <h3>Активные legacy подписки</h3>
      <Table
        columns={subscriptionColumns}
        dataSource={usersWithSubs}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="Подписок пока нет" /> }}
      />

      <h3 style={{ marginTop: 20 }}>Шаблоны тарифов v2</h3>
      <Table
        columns={templateColumns}
        dataSource={planTemplates ?? []}
        rowKey="id"
        loading={templatesLoading}
        size="middle"
        pagination={{ pageSize: 8 }}
      />

      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <h3>Entitlements пользователя</h3>
        <Select
          showSearch
          style={{ width: 460 }}
          placeholder="Выберите пользователя"
          onSearch={setUserSearch}
          filterOption={false}
          options={usersOptions}
          onChange={(v) => setSelectedEntitlementsUserId(v)}
        />
      </div>
      <Table
        columns={entitlementColumns}
        dataSource={entitlements ?? []}
        rowKey="id"
        loading={entitlementsLoading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Выдать legacy подписку"
        open={subscriptionModalOpen}
        onCancel={() => {
          setSubscriptionModalOpen(false);
          subscriptionForm.resetFields();
        }}
        onOk={() => subscriptionForm.submit()}
        confirmLoading={grantSubscription.isPending}
      >
        <Form form={subscriptionForm} layout="vertical" onFinish={(values) => grantSubscription.mutate(values)}>
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true }]}>
            <Select showSearch onSearch={setUserSearch} filterOption={false} options={usersOptions} />
          </Form.Item>
          <Form.Item name="planType" label="Тип" initialValue="trial" rules={[{ required: true }]}>
            <Select options={PLAN_TYPES} />
          </Form.Item>
          <Form.Item name="examTypeId" label="Экзамен">
            <Select allowClear options={examTypes?.map((e: any) => ({ value: e.id, label: e.slug }))} />
          </Form.Item>
          <Form.Item name="dateRange" label="Период" initialValue={[dayjs(), dayjs().add(1, 'day')]} rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="paymentNote" label="Заметка">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Создать шаблон v2"
        open={templateModalOpen}
        onCancel={() => {
          setTemplateModalOpen(false);
          templateForm.resetFields();
        }}
        onOk={() => templateForm.submit()}
        confirmLoading={createPlanTemplate.isPending}
      >
        <Form form={templateForm} layout="vertical" onFinish={(values) => createPlanTemplate.mutate(values)}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input placeholder="ent-paid-monthly" />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="durationDays" label="Дней">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="totalAttemptsLimit" label="Total limit">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="dailyAttemptsLimit" label="Day limit">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="isPremium" label="Premium" initialValue={false}>
            <Select options={[{ value: true, label: 'Да' }, { value: false, label: 'Нет' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Выдать entitlement"
        open={entitlementModalOpen}
        onCancel={() => {
          setEntitlementModalOpen(false);
          entitlementForm.resetFields();
        }}
        onOk={() => entitlementForm.submit()}
        confirmLoading={grantEntitlement.isPending}
      >
        <Form form={entitlementForm} layout="vertical" onFinish={(values) => grantEntitlement.mutate(values)}>
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true }]}>
            <Select showSearch onSearch={setUserSearch} filterOption={false} options={usersOptions} />
          </Form.Item>
          <Form.Item name="examTypeId" label="Экзамен" rules={[{ required: true }]}>
            <Select options={examTypes?.map((e: any) => ({ value: e.id, label: e.slug }))} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="tier" label="Tier" initialValue="trial" rules={[{ required: true }]}>
              <Select options={ENTITLEMENT_TIERS} />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="active" rules={[{ required: true }]}>
              <Select options={ENTITLEMENT_STATUSES} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="totalAttemptsLimit" label="Total limit">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="dailyAttemptsLimit" label="Daily limit">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="usedAttemptsTotal" label="Used">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="timezone" label="Timezone">
            <Input placeholder="Asia/Almaty" />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="Период"
            initialValue={[dayjs(), dayjs().add(30, 'day')]}
            rules={[{ required: true }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} showTime />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
