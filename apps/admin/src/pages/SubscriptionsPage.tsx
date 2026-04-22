import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Tag,
  Alert,
  Empty,
  Popconfirm,
  Typography,
  Tooltip,
} from 'antd';
import { PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

const PLAN_TYPES = [
  { value: 'trial',        label: 'Пробный (1 тест, 24ч)' },
  { value: 'weekly',       label: 'Неделя' },
  { value: 'monthly',      label: 'Месяц' },
  { value: 'yearly',       label: 'Год' },
  { value: 'exam_specific',label: 'На конкретный экзамен' },
];

const PLAN_PRESETS: Record<string, { days: number }> = {
  trial:         { days: 1 },
  weekly:        { days: 7 },
  monthly:       { days: 30 },
  yearly:        { days: 365 },
  exam_specific: { days: 30 },
};

function planLabel(planType: string) {
  return PLAN_TYPES.find((p) => p.value === planType)?.label ?? planType;
}

function planColor(planType: string) {
  const map: Record<string, string> = {
    trial:         'blue',
    weekly:        'cyan',
    monthly:       'gold',
    yearly:        'green',
    exam_specific: 'purple',
  };
  return map[planType] ?? 'default';
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [userSearch, setUserSearch] = useState('');

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

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-with-subs'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { limit: 200 } });
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
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-subs'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Подписка выдана');
    },
    onError: () => message.error('Ошибка при выдаче'),
  });

  const revokeSubscription = useMutation({
    mutationFn: async (subId: string) => {
      await api.delete(`/admin/subscriptions/${subId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-subs'] });
      message.success('Подписка отозвана');
    },
    onError: () => message.error('Ошибка при отзыве'),
  });

  // When plan type changes - auto-fill date range
  const handlePlanTypeChange = (planType: string) => {
    const preset = PLAN_PRESETS[planType];
    if (preset) {
      const start = dayjs();
      const end = dayjs().add(preset.days, 'day');
      form.setFieldValue('dateRange', [start, end]);
    }
  };

  const usersWithSubs = (users?.items || []).filter((u: any) => u.hasActiveSubscription);

  const columns: ColumnsType<any> = [
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
      title: 'Статус',
      width: 160,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        if (!sub) return <Tag>Нет</Tag>;
        return (
          <Tooltip title={`Тариф: ${planLabel(sub.planType)}`}>
            <Tag color={planColor(sub.planType)}>{planLabel(sub.planType)}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Действует до',
      width: 130,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        if (!sub?.expiresAt) return '—';
        return new Date(sub.expiresAt).toLocaleDateString('ru-RU');
      },
    },
    {
      title: 'Заметка',
      ellipsis: true,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        return sub?.paymentNote ?? '—';
      },
    },
    {
      title: 'Действия',
      width: 110,
      render: (_: unknown, record: any) => {
        const sub = record.subscriptions?.[0];
        if (!sub) return null;
        return (
          <Popconfirm
            title="Отозвать подписку?"
            description="Пользователь потеряет доступ к тестам."
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
        message="Отображаются только пользователи с активной подпиской. Пробный тариф даёт ровно 1 прохождение теста за 24 часа."
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
        okText="Выдать"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={(v) => grantSubscription.mutate(v)}>
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true, message: 'Выберите пользователя' }]}>
            <Select
              showSearch
              placeholder="Поиск по username / имени"
              onSearch={setUserSearch}
              filterOption={false}
              options={usersData?.items?.map((u: any) => ({
                value: u.id,
                label: `${u.firstName || ''} ${u.lastName || ''} (@${u.telegramUsername || u.telegramId})`,
              }))}
            />
          </Form.Item>

          <Form.Item name="planType" label="Тип подписки" rules={[{ required: true }]} initialValue="trial">
            <Select
              options={PLAN_TYPES}
              onChange={handlePlanTypeChange}
            />
          </Form.Item>

          <Form.Item name="examTypeId" label="Экзамен (если конкретный)">
            <Select
              allowClear
              placeholder="Все экзамены"
              options={examTypes?.map((e: any) => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>

          <Form.Item name="dateRange" label="Период действия" rules={[{ required: true, message: 'Укажите период' }]}>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              showTime={false}
              defaultValue={[dayjs(), dayjs().add(1, 'day')]}
            />
          </Form.Item>

          <Form.Item name="paymentNote" label="Заметка об оплате">
            <Input.TextArea rows={2} placeholder="Например: Kaspi 2400 тг / Пробный по запросу" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
