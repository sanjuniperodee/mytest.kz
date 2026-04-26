import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, QuestionCircleOutlined, StopOutlined } from '@ant-design/icons';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

function humanizeApiMessage(raw: string): string {
  if (raw.includes('PLAN_TEMPLATE_HAS_NO_EXAM_RULES')) {
    return 'У выбранного тарифа нет правил по экзаменам. Во вкладке «Шаблоны» нажмите «Правила экзаменов», добавьте хотя бы один экзамен и сохраните — затем снова «Выдать подписку». Либо используйте Legacy во вкладке «Проверка и редкие сценарии», если подходит planType-выдача.';
  }
  return raw;
}

function apiErr(e: unknown, fallback: string): string {
  if (isAxiosError(e) && e.response?.data) {
    const d = e.response.data as { message?: string | string[] };
    if (typeof d.message === 'string') return humanizeApiMessage(d.message);
    if (Array.isArray(d.message) && d.message[0]) return humanizeApiMessage(d.message[0]);
  }
  return humanizeApiMessage(fallback);
}

const LEGACY_PLAN_TYPES = [
  {
    value: 'trial',
    label: 'trial — микропакет',
    hint: 'В коде как «разовая попытка»: 1 тест ЕНТ за период, как у платного пакета trial в биллинге.',
  },
  { value: 'week', label: 'week', hint: 'Доступ как у тарифа «неделя» (подписка, безлимит попыток по ent-логике legacy).' },
  { value: 'month', label: 'month', hint: 'Как «месяц».' },
  { value: 'annual', label: 'annual', hint: 'Как «год».' },
];

/** Длительность по умолчанию для дат в legacy-модалке (календарные дни с «сейчас»). */
const LEGACY_PLAN_DAYS: Record<string, number> = {
  trial: 14,
  week: 7,
  month: 30,
  annual: 365,
};

type PlanTemplateExamRule = {
  id?: string;
  examTypeId: string;
  isUnlimited: boolean;
  totalAttemptsLimit?: number | null;
  dailyAttemptsLimit?: number | null;
  examType?: { slug: string };
};

type PlanTemplateRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  durationDays?: number | null;
  totalAttemptsLimit?: number | null;
  dailyAttemptsLimit?: number | null;
  isPremium?: boolean;
  examRules?: PlanTemplateExamRule[];
};

const ENTITLEMENT_TIERS = [
  { value: 'free', label: 'free' },
  { value: 'trial', label: 'trial' },
  { value: 'paid', label: 'paid' },
  { value: 'admin', label: 'admin' },
];

const ENTITLEMENT_STATUSES = [
  { value: 'active', label: 'active' },
  { value: 'exhausted', label: 'exhausted' },
  { value: 'revoked', label: 'revoked' },
  { value: 'expired', label: 'expired' },
];

type ExamOption = { value: string; label: string };

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState('');
  const [selectedEntitlementsUserId, setSelectedEntitlementsUserId] = useState<string | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PlanTemplateRow | null>(null);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [applyTemplateIdPrefill, setApplyTemplateIdPrefill] = useState<string | null>(null);
  const [subscriptionTab, setSubscriptionTab] = useState('grant');

  const [applyForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [editTemplateForm] = Form.useForm();
  const [subscriptionForm] = Form.useForm();
  const [entitlementForm] = Form.useForm();

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: async () => (await api.get('/admin/users', { params: { search: userSearch, limit: 200 } })).data,
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
      (await api.get(`/admin/subscriptions/users/${selectedEntitlementsUserId}/entitlements`)).data,
  });

  const examOptions: ExamOption[] = useMemo(
    () => (examTypes ?? []).map((e: { id: string; slug: string }) => ({ value: e.id, label: e.slug })),
    [examTypes],
  );

  const userOptions = useMemo(
    () =>
      (usersData?.items ?? []).map((u: Record<string, unknown>) => {
        const fn = (u.firstName as string) || '';
        const ln = (u.lastName as string) || '';
        const h = (u.telegramUsername as string) || String(u.telegramId);
        return {
          value: u.id as string,
          label: `${fn} ${ln}`.trim() || h,
        };
      }),
    [usersData?.items],
  );

  useEffect(() => {
    if (applyTemplateIdPrefill) {
      applyForm.setFieldValue('planTemplateId', applyTemplateIdPrefill);
      setSubscriptionTab('grant');
    }
  }, [applyTemplateIdPrefill, applyForm]);

  const applyPlanTemplate = useMutation({
    mutationFn: async (v: {
      userId: string;
      planTemplateId: string;
      startsAt: dayjs.Dayjs;
      endsAt?: dayjs.Dayjs | null;
      paymentNote?: string;
    }) => {
      await api.post('/admin/subscriptions/apply-plan-template', {
        userId: v.userId,
        planTemplateId: v.planTemplateId,
        windowStartsAt: v.startsAt.toISOString(),
        windowEndsAt: v.endsAt ? v.endsAt.toISOString() : null,
        paymentNote: v.paymentNote?.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-plan-templates'] });
      message.success('Шаблон применён: entitlements созданы');
      applyForm.resetFields();
      setApplyTemplateIdPrefill(null);
    },
    onError: (e) => message.error(apiErr(e, 'Не удалось применить шаблон')),
  });

  const grantSubscription = useMutation({
    mutationFn: async (values: {
      userId: string;
      planType: string;
      examTypeId?: string;
      dateRange: [dayjs.Dayjs, dayjs.Dayjs];
      paymentNote?: string;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      setSubscriptionModalOpen(false);
      subscriptionForm.resetFields();
      message.success('Запись Subscription создана, entitlements синхронизированы');
    },
    onError: (e) => message.error(apiErr(e, 'Ошибка при выдаче legacy-подписки')),
  });

  const createPlanTemplate = useMutation({
    mutationFn: async (values: {
      code: string;
      name: string;
      description?: string;
      isPremium: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      rules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    }) => {
      const rules = (values.rules ?? [])
        .filter((r) => r.examTypeId)
        .map((r, i) => ({
          examTypeId: r.examTypeId,
          totalAttemptsLimit: r.isUnlimited ? null : (r.totalAttemptsLimit ?? null),
          dailyAttemptsLimit: r.dailyAttemptsLimit ?? null,
          isUnlimited: !!r.isUnlimited,
          sortOrder: r.sortOrder ?? i,
        }));
      await api.post('/admin/subscriptions/plan-templates', {
        code: values.code,
        name: values.name,
        description: values.description || null,
        isPremium: !!values.isPremium,
        durationDays: values.durationDays ?? null,
        totalAttemptsLimit: values.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: values.dailyAttemptsLimit ?? null,
        rules,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-templates'] });
      setTemplateModalOpen(false);
      templateForm.resetFields();
      message.success('Шаблон создан');
    },
    onError: (e) => message.error(apiErr(e, 'Ошибка при создании шаблона')),
  });

  const updatePlanTemplate = useMutation({
    mutationFn: async (values: {
      id: string;
      name: string;
      description?: string;
      isPremium: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      rules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    }) => {
      const rules = (values.rules ?? [])
        .filter((r) => r.examTypeId)
        .map((r, i) => ({
          examTypeId: r.examTypeId,
          totalAttemptsLimit: r.isUnlimited ? null : (r.totalAttemptsLimit ?? null),
          dailyAttemptsLimit: r.dailyAttemptsLimit ?? null,
          isUnlimited: !!r.isUnlimited,
          sortOrder: r.sortOrder ?? i,
        }));
      if (rules.length === 0) {
        throw new Error('Добавьте хотя бы одно правило: выберите экзамен');
      }
      await api.patch(`/admin/subscriptions/plan-templates/${values.id}`, {
        name: values.name,
        description: values.description || null,
        isPremium: !!values.isPremium,
        durationDays: values.durationDays ?? null,
        totalAttemptsLimit: values.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: values.dailyAttemptsLimit ?? null,
        replaceRules: rules,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-templates'] });
      setEditTemplateOpen(false);
      setEditingTemplate(null);
      editTemplateForm.resetFields();
      message.success('Шаблон и правила сохранены');
    },
    onError: (e) => {
      if (e instanceof Error && !isAxiosError(e)) {
        message.error(e.message);
        return;
      }
      message.error(apiErr(e, 'Не удалось сохранить шаблон'));
    },
  });

  const grantEntitlement = useMutation({
    mutationFn: async (values: {
      userId: string;
      examTypeId: string;
      tier: string;
      status: string;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      usedAttemptsTotal?: number;
      timezone?: string;
      dateRange: [dayjs.Dayjs, dayjs.Dayjs | null];
    }) => {
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
        windowEndsAt: values.dateRange[1] ? values.dateRange[1].toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      setEntitlementModalOpen(false);
      entitlementForm.resetFields();
      message.success('Entitlement создан');
    },
    onError: (e) => message.error(apiErr(e, 'Ошибка при выдаче entitlement')),
  });

  const adjustAttempts = useMutation({
    mutationFn: async (p: { entitlementId: string; delta: number; reasonCode?: string }) => {
      await api.post(`/admin/subscriptions/entitlements/${p.entitlementId}/adjust-attempts`, {
        delta: p.delta,
        reasonCode: p.reasonCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Скорректировано');
    },
    onError: (e) => message.error(apiErr(e, 'Ошибка корректировки')),
  });

  const updateEntitlementStatus = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      await api.patch(`/admin/subscriptions/entitlements/${p.id}`, { status: p.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Статус обновлён');
    },
    onError: (e) => message.error(apiErr(e, 'Не удалось обновить')),
  });

  const revokeSubscription = useMutation({
    mutationFn: async (subId: string) => {
      await api.delete(`/admin/subscriptions/${subId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements'] });
      message.success('Подписка отозвана');
    },
    onError: (e) => message.error(apiErr(e, 'Ошибка при отзыве')),
  });

  const usersWithSubs = (usersData?.items ?? []).filter(
    (u: { subscriptions?: unknown[] }) => (u.subscriptions?.length ?? 0) > 0,
  );

  const subscriptionListColumns: ColumnsType<any> = [
    { title: 'План (planType)', dataIndex: 'planType', width: 140 },
    {
      title: 'С',
      render: (_, r) => new Date(r.startsAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
    },
    {
      title: 'По',
      render: (_, r) => new Date(r.expiresAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
    },
    {
      title: 'Статус',
      render: (_, r) => (r.isActive ? <Tag color="green">active</Tag> : <Tag>off</Tag>),
    },
    {
      title: '',
      width: 120,
      render: (_, r) =>
        r.isActive ? (
          <Popconfirm
            title="Отозвать эту подписку?"
            onConfirm={() => revokeSubscription.mutate(r.id)}
            okText="Отозвать"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: revokeSubscription.isPending }}
          >
            <Button size="small" danger icon={<StopOutlined />}>
              Отозвать
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  const userSubscriptionColumns: ColumnsType<Record<string, unknown>> = [
    {
      title: 'Пользователь',
      render: (_: unknown, record: Record<string, unknown>) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {String(record.firstName || '')} {String(record.lastName || '')}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            @{String(record.telegramUsername || record.telegramId)}
            {record.phone ? ` · +${String(record.phone)}` : ''}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Подписок',
      width: 100,
      render: (_: unknown, r: { subscriptions?: unknown[] }) => (
        <Tag>{(r.subscriptions?.length ?? 0)}</Tag>
      ),
    },
  ];

  const openTemplateRulesEditor = (row: PlanTemplateRow) => {
    setEditingTemplate(row);
    setEditTemplateOpen(true);
    setSubscriptionTab('templates');
    const rules: Array<{
      examTypeId: string;
      isUnlimited: boolean;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
    }> =
      (row.examRules?.length ?? 0) > 0
        ? (row.examRules ?? []).map((r) => ({
            examTypeId: r.examTypeId,
            isUnlimited: !!r.isUnlimited,
            totalAttemptsLimit: r.totalAttemptsLimit ?? undefined,
            dailyAttemptsLimit: r.dailyAttemptsLimit ?? undefined,
          }))
        : [{ isUnlimited: false, examTypeId: '' }];
    editTemplateForm.setFieldsValue({
      name: row.name,
      description: row.description ?? '',
      durationDays: row.durationDays ?? undefined,
      totalAttemptsLimit: row.totalAttemptsLimit ?? undefined,
      dailyAttemptsLimit: row.dailyAttemptsLimit ?? undefined,
      isPremium: !!row.isPremium,
      rules,
    });
  };

  const templateColumns: ColumnsType<PlanTemplateRow> = [
    { title: 'Code', dataIndex: 'code', width: 200 },
    { title: 'Название', dataIndex: 'name' },
    {
      title: 'Правил по экзаменам',
      width: 180,
      render: (_: unknown, row: { examRules?: unknown[] }) => (row.examRules?.length ?? 0) || 0,
    },
    {
      title: 'Период (дн.)',
      dataIndex: 'durationDays',
      width: 110,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: 'Premium',
      dataIndex: 'isPremium',
      width: 100,
      render: (v: boolean) => (v ? <Tag color="gold">да</Tag> : <Tag>нет</Tag>),
    },
    {
      title: 'Действия',
      width: 280,
      fixed: 'right',
      render: (_: unknown, row: PlanTemplateRow) => (
        <Space size={0} wrap>
          <Button type="link" size="small" onClick={() => openTemplateRulesEditor(row)}>
            Правила экзаменов
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setApplyTemplateIdPrefill(row.id);
              setSubscriptionTab('grant');
              applyForm.setFieldsValue({ planTemplateId: row.id, userId: applyForm.getFieldValue('userId') });
              document.getElementById('apply-plan-template-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            К выдаче
          </Button>
        </Space>
      ),
    },
  ];

  const entitlementColumns: ColumnsType<any> = [
    {
      title: 'Экзамен',
      width: 130,
      render: (_: unknown, row: { examType?: { slug?: string }; examTypeId?: string }) =>
        row.examType?.slug ?? row.examTypeId,
    },
    { title: 'Tier', dataIndex: 'tier', width: 80 },
    {
      title: 'Источник',
      width: 130,
      render: (_: unknown, row: { sourceType?: string; planTemplate?: { code?: string } }) => (
        <span>
          {row.sourceType}
          {row.planTemplate?.code ? (
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
              tpl: {row.planTemplate.code}
            </Typography.Text>
          ) : null}
        </span>
      ),
    },
    {
      title: 'Статус',
      width: 200,
      render: (_: unknown, row: any) => (
        <Select
          size="small"
          value={row.status}
          style={{ width: 180 }}
          options={ENTITLEMENT_STATUSES}
          onChange={(status) => updateEntitlementStatus.mutate({ id: String(row.id), status })}
        />
      ),
    },
    {
      title: 'Остаток total',
      width: 130,
      render: (_: unknown, row: { totalAttemptsLimit?: number | null; usedAttemptsTotal?: number }) => {
        if (row.totalAttemptsLimit == null) return '∞';
        return `${Math.max(0, (row.totalAttemptsLimit ?? 0) - (row.usedAttemptsTotal ?? 0))} / ${
          row.totalAttemptsLimit
        }`;
      },
    },
    { title: 'Day limit', width: 90, render: (_: unknown, row: { dailyAttemptsLimit?: number | null }) => row.dailyAttemptsLimit ?? '∞' },
    {
      title: 'Окно',
      render: (_: unknown, row: { windowStartsAt?: string; windowEndsAt?: string | null }) =>
        `${new Date(String(row.windowStartsAt)).toLocaleDateString('ru-RU')} → ${
          row.windowEndsAt ? new Date(String(row.windowEndsAt)).toLocaleDateString('ru-RU') : '∞'
        }`,
    },
    {
      title: '± попыток',
      width: 200,
      render: (_: unknown, row: any) => (
        <Space wrap>
          {[-5, -1, 1, 5].map((d) => (
            <Button
              key={d}
              size="small"
              onClick={() => adjustAttempts.mutate({ entitlementId: String(row.id), delta: d })}
            >
              {d > 0 ? `+${d}` : d}
            </Button>
          ))}
        </Space>
      ),
    },
  ];

  const planTemplateOptions = (planTemplates ?? []).map((p: PlanTemplateRow) => {
    const n = (p.examRules?.length ?? 0) as number;
    const disabled = n === 0;
    return {
      value: p.id,
      label: `${p.code} — ${p.name}${n ? ` · ${n} экз.` : ' · нет правил'}`,
      disabled,
      title: disabled ? 'Добавьте правила экзаменов в шаблон (вкладка «Шаблоны»)' : p.description ?? p.name,
    };
  });

  return (
    <div className="admin-subscriptions-page">
      <p className="admin-hint" style={{ marginTop: 0 }}>
        Выдача: пользователь + шаблон тарифа, затем «Выдать».
      </p>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Tabs
          activeKey={subscriptionTab}
          onChange={setSubscriptionTab}
          items={[
            {
              key: 'grant',
              label: 'Выдача',
              children: (
                <Card
                  id="apply-plan-template-form"
                  title="Оплата — выдать доступ"
                  extra={<QuestionCircleOutlined title="Создаёт записи v2 (entitlements) по всем правилам шаблона" />}
                >
                  <Form
                    form={applyForm}
                    layout="vertical"
                    onFinish={(values) => applyPlanTemplate.mutate(values)}
                    initialValues={{ startsAt: dayjs() }}
                    onValuesChange={(changed) => {
                      if (Object.prototype.hasOwnProperty.call(changed, 'planTemplateId')) {
                        applyForm.setFieldValue('endsAt', null);
                      }
                    }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="userId"
                          label="Пользователь"
                          rules={[{ required: true, message: 'Выберите пользователя' }]}
                        >
                          <Select
                            showSearch
                            allowClear
                            placeholder="Поиск: @username, имя, телефон"
                            onSearch={setUserSearch}
                            filterOption={false}
                            options={userOptions}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="planTemplateId"
                          label="Тариф (шаблон)"
                          rules={[{ required: true, message: 'Выберите тариф' }]}
                        >
                          <Select
                            showSearch
                            allowClear
                            loading={templatesLoading}
                            placeholder="Код или название"
                            optionFilterProp="label"
                            options={planTemplateOptions}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev.planTemplateId !== cur.planTemplateId || prev.startsAt !== cur.startsAt
                      }
                    >
                      {() => {
                        const tid = applyForm.getFieldValue('planTemplateId') as string | undefined;
                        const st = applyForm.getFieldValue('startsAt') as dayjs.Dayjs | undefined;
                        const tpl = (planTemplates ?? []).find((p: PlanTemplateRow) => p.id === tid);
                        if (!tpl || !st) {
                          return (
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                              После выбора тарифа здесь отобразятся сроки доступа.
                            </Typography.Paragraph>
                          );
                        }
                        const rulesCount = (tpl.examRules?.length ?? 0) as number;
                        if (rulesCount === 0) {
                          return (
                            <Typography.Paragraph type="warning" style={{ marginBottom: 16 }}>
                              У этого тарифа нет правил по экзаменам — выдача будет отклонена. Настройте шаблон на
                              вкладке «Шаблоны».
                            </Typography.Paragraph>
                          );
                        }
                        if (tpl.durationDays != null) {
                          const end = st.add(tpl.durationDays, 'day');
                          return (
                            <Typography.Paragraph style={{ marginBottom: 16 }}>
                              <strong>Период:</strong> с {st.format('DD.MM.YYYY HH:mm')} по{' '}
                              {end.format('DD.MM.YYYY HH:mm')}{' '}
                              <Typography.Text type="secondary">({tpl.durationDays} дн. по тарифу)</Typography.Text>
                            </Typography.Paragraph>
                          );
                        }
                        return (
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                            В шаблоне не задан срок (дни). Укажите дату окончания ниже или оставьте пустой — окно
                            будет без даты окончания.
                          </Typography.Paragraph>
                        );
                      }}
                    </Form.Item>
                    <Row gutter={16} align="bottom">
                      <Col xs={24} sm={12} md={10}>
                        <Form.Item name="startsAt" label="Старт" rules={[{ required: true, message: 'Укажите' }]}>
                          <DatePicker showTime style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} md={10}>
                        <Form.Item
                          name="endsAt"
                          label="Конец (необязательно)"
                          extra="Если пусто: при наличии «дней в тарифе» срок на сервере; иначе без даты окончания. Заполните, чтобы вручную сократить или продлить срок."
                        >
                          <DatePicker
                            showTime
                            allowClear
                            style={{ width: '100%' }}
                            format="DD.MM.YYYY HH:mm"
                            placeholder="По умолчанию от тарифа"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="paymentNote" label="Комментарий (аудит, по желанию)">
                      <Input.TextArea rows={1} placeholder="№ оплаты, касса, куратор" autoSize={{ minRows: 1, maxRows: 3 }} />
                    </Form.Item>
                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      loading={applyPlanTemplate.isPending}
                      block
                    >
                      Выдать подписку
                    </Button>
                  </Form>
                </Card>
              ),
            },
            {
              key: 'templates',
              label: 'Шаблоны',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Card
                    title="Каталог тарифов (шаблоны v2)"
                    extra={
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setTemplateModalOpen(true)}>
                        Новый шаблон
                      </Button>
                    }
                  >
                    <Typography.Paragraph type="secondary">
                      У шаблона должны быть <strong>правила по экзаменам</strong>. Глобальные лимиты на карточке
                      подставляются в правила, если в строке не переопределили.
                    </Typography.Paragraph>
                    <Table<PlanTemplateRow>
                      columns={templateColumns}
                      dataSource={planTemplates ?? []}
                      rowKey="id"
                      loading={templatesLoading}
                      pagination={{ pageSize: 8 }}
                      scroll={{ x: 900 }}
                      expandable={{
                        expandedRowRender: (row) =>
                          (row.examRules?.length ?? 0) > 0 ? (
                            <Table
                              size="small"
                              pagination={false}
                              rowKey="id"
                              dataSource={row.examRules as PlanTemplateExamRule[]}
                              columns={[
                                { title: 'Экзамен', render: (r: PlanTemplateExamRule) => r.examType?.slug },
                                {
                                  title: 'Total',
                                  render: (r: PlanTemplateExamRule) =>
                                    r.isUnlimited ? '∞' : (r.totalAttemptsLimit ?? '—'),
                                },
                                { title: 'Day', render: (r: PlanTemplateExamRule) => r.dailyAttemptsLimit ?? '—' },
                              ]}
                            />
                          ) : (
                            <Typography.Text type="danger">
                              Нет правил — в таблице нажмите «Правила экзаменов» и сохраните хотя бы один экзамен.
                            </Typography.Text>
                          ),
                      }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'more',
              label: 'Проверка и редкие сценарии',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Collapse
                    items={[
                      {
                        key: 'how',
                        label: 'Как устроены подписки (документация для админа)',
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Typography.Paragraph>
                              <strong>Тариф (шаблон)</strong> в каталоге — это описание экзаменов и лимитов. Пока
                              шаблон не выдан пользователю, доступ не меняется.
                            </Typography.Paragraph>
                            <Typography.Paragraph>
                              <strong>Выдача</strong> создаёт записи v2, источник <Tag>plan_template</Tag>, по
                              количеству правил в шаблоне.
                            </Typography.Paragraph>
                            <Typography.Paragraph>
                              <strong>Legacy Subscription</strong> — строка как после оплаты (planType);
                              движок синхронизирует entitlements. Нужна для согласованности с биллингом.
                            </Typography.Paragraph>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                              <strong>Ручной entitlement</strong> — одна запись, один экзамен, без шаблона:{' '}
                              <Tag>admin_override</Tag>.
                            </Typography.Paragraph>
                          </Space>
                        ),
                      },
                    ]}
                  />
                  <Card title="Legacy (как в биллинге, planType)">
                    <Typography.Paragraph type="secondary">
                      Создаётся <code>Subscription</code> + синхронизация, если нужен именно legacy-поведение.
                    </Typography.Paragraph>
                    <Button type="default" onClick={() => setSubscriptionModalOpen(true)}>
                      Форма legacy
                    </Button>
                  </Card>
                  <Card title="Точечный entitlement (поддержка)">
                    <Button onClick={() => setEntitlementModalOpen(true)}>Создать вручную</Button>
                  </Card>
                  <Card title="Активные legacy-подписки">
                    <Table
                      columns={userSubscriptionColumns}
                      dataSource={usersWithSubs}
                      rowKey="id"
                      loading={usersLoading}
                      pagination={{ pageSize: 8 }}
                      expandable={{
                        rowExpandable: (r: { subscriptions?: unknown[] }) => (r.subscriptions?.length ?? 0) > 0,
                        expandedRowRender: (r: any) => (
                          <Table
                            size="small"
                            rowKey="id"
                            columns={subscriptionListColumns}
                            dataSource={r.subscriptions}
                            pagination={false}
                          />
                        ),
                      }}
                      locale={{ emptyText: <Empty description="Нет legacy-подписок" /> }}
                    />
                  </Card>
                  <Card title="Entitlements выбранного пользователя (v2)">
                    <Select
                      showSearch
                      allowClear
                      style={{ maxWidth: 480, width: '100%', marginBottom: 12 }}
                      placeholder="Пользователь"
                      onSearch={setUserSearch}
                      filterOption={false}
                      options={userOptions}
                      value={selectedEntitlementsUserId || undefined}
                      onChange={(v) => setSelectedEntitlementsUserId(v ?? null)}
                    />
                    <Table
                      columns={entitlementColumns}
                      dataSource={entitlements ?? []}
                      rowKey="id"
                      loading={entitlementsLoading}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1100 }}
                      locale={{ emptyText: <Empty description="Выберите пользователя" /> }}
                    />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title="Legacy: выдать подписку (Subscription)"
        open={subscriptionModalOpen}
        width={640}
        destroyOnClose
        onCancel={() => {
          setSubscriptionModalOpen(false);
          subscriptionForm.resetFields();
        }}
        onOk={() => subscriptionForm.submit()}
        confirmLoading={grantSubscription.isPending}
      >
        <Form
          form={subscriptionForm}
          layout="vertical"
          onFinish={(v) => grantSubscription.mutate(v)}
          initialValues={{ planType: 'month', dateRange: [dayjs(), dayjs().add(LEGACY_PLAN_DAYS.month, 'day')] }}
          onValuesChange={(changed) => {
            if (Object.prototype.hasOwnProperty.call(changed, 'planType')) {
              const pt = String(changed.planType);
              const days = LEGACY_PLAN_DAYS[pt] ?? 30;
              subscriptionForm.setFieldValue('dateRange', [dayjs(), dayjs().add(days, 'day')]);
            }
          }}
        >
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true }]}>
            <Select showSearch onSearch={setUserSearch} filterOption={false} options={userOptions} />
          </Form.Item>
          <Form.Item
            name="planType"
            label={
              <Space>
                Тариф (plan type)
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  даты подставятся под срок
                </Typography.Text>
              </Space>
            }
            rules={[{ required: true }]}
          >
            <Select
              options={LEGACY_PLAN_TYPES.map((p) => ({
                value: p.value,
                label: p.label,
                title: p.hint,
              }))}
            />
          </Form.Item>
          <Form.Item name="examTypeId" label="Ограничить одним экзаменом (опционально)">
            <Select allowClear options={examOptions} placeholder="Пусто = как в sync по planType" />
          </Form.Item>
          <Form.Item name="dateRange" label="Период startsAt / expiresAt" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="paymentNote" label="Платёж / комментарий (аудит)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый шаблон"
        open={templateModalOpen}
        width={720}
        onCancel={() => {
          setTemplateModalOpen(false);
          templateForm.resetFields();
        }}
        onOk={() => templateForm.submit()}
        confirmLoading={createPlanTemplate.isPending}
        destroyOnClose
      >
        <Form form={templateForm} layout="vertical" onFinish={(v) => createPlanTemplate.mutate(v)} initialValues={{ isPremium: false, rules: [{}] }}>
          <Form.Item name="code" label="Code (уникальный)" rules={[{ required: true }]}>
            <Input placeholder="ent_month_2025" />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание (для админов)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="durationDays" label="Срок, дней (для auto end)">
              <InputNumber min={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="totalAttemptsLimit" label="Total default">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="dailyAttemptsLimit" label="Daily default">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isPremium" label="Premium" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </Space>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Правила по экзаменам (обязательно для применения шаблона)
          </Typography.Text>
          <Form.List name="rules">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Card key={field.key} size="small" type="inner">
                    <Row gutter={8} align="middle">
                      <Col flex="1 1 200px">
                        <Form.Item
                          {...field}
                          name={[field.name, 'examTypeId']}
                          label="Экзамен"
                          rules={[{ required: true }]}
                        >
                          <Select options={examOptions} placeholder="slug" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item
                          {...field}
                          name={[field.name, 'isUnlimited']}
                          valuePropName="checked"
                          label="Без лим. total"
                          initialValue={false}
                        >
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item {...field} name={[field.name, 'totalAttemptsLimit']} label="Total">
                          <InputNumber min={0} style={{ width: 90 }} placeholder="при лимите" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item {...field} name={[field.name, 'dailyAttemptsLimit']} label="Day">
                          <InputNumber min={0} style={{ width: 80 }} />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Button type="text" danger onClick={() => remove(field.name)} disabled={fields.length <= 0}>
                          Удалить
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ isUnlimited: false })} block icon={<PlusOutlined />}>
                  Добавить экзамен
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={
          editingTemplate
            ? `Правила экзаменов: ${editingTemplate.code}`
            : 'Правила экзаменов'
        }
        open={editTemplateOpen}
        width={720}
        onCancel={() => {
          setEditTemplateOpen(false);
          setEditingTemplate(null);
          editTemplateForm.resetFields();
        }}
        onOk={() => editTemplateForm.submit()}
        confirmLoading={updatePlanTemplate.isPending}
        destroyOnClose
      >
        {editingTemplate ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Code <code>{editingTemplate.code}</code> менять нельзя. «Сохранить» перезаписывает список правил (
            <code>replaceRules</code>).
          </Typography.Paragraph>
        ) : null}
        <Form
          form={editTemplateForm}
          layout="vertical"
          onFinish={(v) => {
            if (!editingTemplate) return;
            updatePlanTemplate.mutate({ id: editingTemplate.id, ...v });
          }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание (для админов)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="durationDays" label="Срок, дней (для auto end)">
              <InputNumber min={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="totalAttemptsLimit" label="Total default">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="dailyAttemptsLimit" label="Daily default">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isPremium" label="Premium" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Правила по экзаменам (нужна минимум одна строка с выбранным экзаменом)
          </Typography.Text>
          <Form.List name="rules">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Card key={field.key} size="small" type="inner">
                    <Row gutter={8} align="middle">
                      <Col flex="1 1 200px">
                        <Form.Item
                          {...field}
                          name={[field.name, 'examTypeId']}
                          label="Экзамен"
                          rules={[{ required: true, message: 'Выберите экзамен' }]}
                        >
                          <Select options={examOptions} placeholder="slug" showSearch optionFilterProp="label" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item
                          {...field}
                          name={[field.name, 'isUnlimited']}
                          valuePropName="checked"
                          label="Без лим. total"
                        >
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item {...field} name={[field.name, 'totalAttemptsLimit']} label="Total">
                          <InputNumber min={0} style={{ width: 90 }} placeholder="при лимите" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item {...field} name={[field.name, 'dailyAttemptsLimit']} label="Day">
                          <InputNumber min={0} style={{ width: 80 }} />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Button type="text" danger onClick={() => remove(field.name)} disabled={fields.length <= 1}>
                          Удалить
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ isUnlimited: false })} block icon={<PlusOutlined />}>
                  Добавить экзамен
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Ручной entitlement"
        open={entitlementModalOpen}
        width={600}
        onCancel={() => {
          setEntitlementModalOpen(false);
          entitlementForm.resetFields();
        }}
        onOk={() => entitlementForm.submit()}
        confirmLoading={grantEntitlement.isPending}
        destroyOnClose
      >
        <Form
          form={entitlementForm}
          layout="vertical"
          onFinish={(v) => grantEntitlement.mutate(v)}
          initialValues={{
            tier: 'paid',
            status: 'active',
            usedAttemptsTotal: 0,
            dateRange: [dayjs(), dayjs().add(30, 'day')],
          }}
        >
          <Form.Item name="userId" label="Пользователь" rules={[{ required: true }]}>
            <Select showSearch onSearch={setUserSearch} filterOption={false} options={userOptions} />
          </Form.Item>
          <Form.Item name="examTypeId" label="Экзамен" rules={[{ required: true }]}>
            <Select options={examOptions} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
              <Select options={ENTITLEMENT_TIERS} style={{ minWidth: 120 }} />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={ENTITLEMENT_STATUSES} style={{ minWidth: 120 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="totalAttemptsLimit" label="Total limit">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="dailyAttemptsLimit" label="Daily">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="usedAttemptsTotal" label="Used">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="timezone" label="Таймзона">
            <Input placeholder="Asia/Almaty" />
          </Form.Item>
          <Form.Item name="dateRange" label="Окно" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
