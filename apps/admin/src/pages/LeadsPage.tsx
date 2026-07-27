import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Drawer,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ContactsOutlined,
  PhoneOutlined,
  SearchOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { PageHero } from '../components/PageHero';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'closed';

type Lead = {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string;
  status: LeadStatus;
  adminNote: string | null;
  contactedAt: string | null;
  notificationStatus: 'pending' | 'sent' | 'failed';
  createdAt: string;
};

type LeadList = {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  counts: Record<LeadStatus, number>;
};

const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'Новая', color: 'blue' },
  contacted: { label: 'Связались', color: 'gold' },
  qualified: { label: 'Целевая', color: 'purple' },
  converted: { label: 'Конверсия', color: 'green' },
  closed: { label: 'Закрыта', color: 'default' },
};

const statusOptions = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [draftStatus, setDraftStatus] = useState<LeadStatus>('new');
  const [adminNote, setAdminNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-leads', { page, status, search: appliedSearch }],
    queryFn: async () => {
      const response = await api.get<LeadList>('/leads/admin/list', {
        params: { page, limit: 25, status, search: appliedSearch || undefined },
      });
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Lead is not selected');
      const response = await api.patch<Lead>(`/leads/admin/${selected.id}`, {
        status: draftStatus,
        adminNote,
      });
      return response.data;
    },
    onSuccess: () => {
      message.success('Заявка обновлена');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
    onError: () => message.error('Не удалось обновить заявку'),
  });

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setDraftStatus(lead.status);
    setAdminNote(lead.adminNote || '');
  };

  const columns = [
      {
        title: 'Контакт',
        key: 'contact',
        render: (_: unknown, lead: Lead) => (
          <Space direction="vertical" size={1}>
            <Typography.Text strong>{lead.name}</Typography.Text>
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
              <PhoneOutlined /> {lead.phone}
            </a>
          </Space>
        ),
      },
      {
        title: 'Источник',
        dataIndex: 'source',
        key: 'source',
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: 'Создана',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value: string) =>
          new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
      },
      {
        title: 'Статус',
        dataIndex: 'status',
        key: 'status',
        render: (value: LeadStatus) => (
          <Tag color={STATUS_META[value].color}>{STATUS_META[value].label}</Tag>
        ),
      },
      {
        title: 'Telegram',
        dataIndex: 'notificationStatus',
        key: 'notificationStatus',
        render: (value: Lead['notificationStatus']) => (
          <Tag color={value === 'sent' ? 'green' : value === 'failed' ? 'red' : 'default'}>
            {value === 'sent' ? 'Доставлено' : value === 'failed' ? 'Ошибка' : 'Ожидает'}
          </Tag>
        ),
      },
      {
        title: '',
        key: 'actions',
        align: 'right' as const,
        render: (_: unknown, lead: Lead) => (
          <Button onClick={() => openLead(lead)}>Открыть</Button>
        ),
      },
  ];

  const counts = data?.counts;

  return (
    <AdminPageShell>
      <PageHero
        eyebrow="Продажи"
        eyebrowIcon={<ContactsOutlined />}
        title="Заявки с лендинга"
        lede="Единая очередь обращений: от первого контакта до конверсии. Изменения статуса и заметок фиксируются в аудите администратора."
      />

      <div className="pg-a__bento" style={{ marginBottom: 20 }}>
        <div className="pg-a__tile">
          <Card bordered={false} style={{ background: 'transparent' }}>
            <Statistic title="Новые" value={counts?.new ?? 0} prefix={<ContactsOutlined />} />
          </Card>
        </div>
        <div className="pg-a__tile">
          <Card bordered={false} style={{ background: 'transparent' }}>
            <Statistic title="Связались" value={counts?.contacted ?? 0} prefix={<PhoneOutlined />} />
          </Card>
        </div>
        <div className="pg-a__tile">
          <Card bordered={false} style={{ background: 'transparent' }}>
            <Statistic title="Целевые" value={counts?.qualified ?? 0} prefix={<StarOutlined />} />
          </Card>
        </div>
        <div className="pg-a__tile">
          <Card bordered={false} style={{ background: 'transparent' }}>
            <Statistic
              title="Конверсии"
              value={counts?.converted ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#248a3d' }}
            />
          </Card>
        </div>
      </div>

      <Card className="hig-surface-card">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            value={search}
            prefix={<SearchOutlined />}
            placeholder="Имя, телефон или источник"
            style={{ width: 280 }}
            onChange={(event) => setSearch(event.target.value)}
            onPressEnter={() => {
              setAppliedSearch(search.trim());
              setPage(1);
            }}
          />
          <Button
            type="primary"
            onClick={() => {
              setAppliedSearch(search.trim());
              setPage(1);
            }}
          >
            Найти
          </Button>
          <Select
            allowClear
            placeholder="Все статусы"
            value={status}
            options={statusOptions}
            style={{ width: 170 }}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </Space>

        <Table<Lead>
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items}
          columns={columns}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 25,
            total: data?.total,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </Card>

      <Drawer
        title={selected ? `${selected.name} · ${selected.phone}` : 'Заявка'}
        width={460}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        extra={
          <Button
            type="primary"
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        {selected && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Typography.Text type="secondary">Сообщение клиента</Typography.Text>
              <Typography.Paragraph style={{ marginTop: 6 }}>
                {selected.message || 'Без комментария'}
              </Typography.Paragraph>
            </div>
            <label>
              <Typography.Text strong>Статус</Typography.Text>
              <Select
                value={draftStatus}
                options={statusOptions}
                style={{ width: '100%', marginTop: 8 }}
                onChange={setDraftStatus}
              />
            </label>
            <label>
              <Typography.Text strong>Заметка команды</Typography.Text>
              <Input.TextArea
                rows={7}
                maxLength={2000}
                showCount
                value={adminNote}
                style={{ marginTop: 8 }}
                placeholder="Что обсудили, следующий шаг, причина закрытия…"
                onChange={(event) => setAdminNote(event.target.value)}
              />
            </label>
          </Space>
        )}
      </Drawer>
    </AdminPageShell>
  );
}
