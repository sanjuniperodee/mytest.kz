import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Empty, Skeleton, Table, Tag } from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  BarChartOutlined,
  RocketOutlined,
  LineChartOutlined,
  BookOutlined,
  ReadOutlined,
  RightOutlined,
  TeamOutlined,
  FormOutlined,
  GlobalOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';

const reportsNav = [
  {
    to: '/analytics',
    icon: <BarChartOutlined />,
    title: 'Воронка платформы',
    sub: 'Визиты, регистрации и тесты по дням',
  },
  {
    to: '/analytics/ent',
    icon: <LineChartOutlined />,
    title: 'ЕНТ по парам',
    sub: 'Профильные пары, языки и качество',
  },
  {
    to: '/analytics/thresholds',
    icon: <BookOutlined />,
    title: 'Пороги вузов',
    sub: 'Грант и сельская квота',
  },
  {
    to: '/admission',
    icon: <RocketOutlined />,
    title: 'Калькулятор шанса',
    sub: 'Поступление и проходные баллы',
  },
];

const opsNav = [
  { to: '/users', title: 'Пользователи', sub: 'Новые регистрации и аккаунты', icon: <TeamOutlined />, tone: 'blue' as const },
  { to: '/finance', title: 'Финансы', sub: 'Оплаты, pending и выручка', icon: <CreditCardOutlined />, tone: 'amber' as const },
  { to: '/subscriptions', title: 'Подписки', sub: 'Выдача и ручные сценарии', icon: <CrownOutlined />, tone: 'violet' as const },
  { to: '/questions', title: 'Вопросы', sub: 'Банк заданий и языки', icon: <FormOutlined />, tone: 'teal' as const },
  { to: '/landing-settings', title: 'Лендинг', sub: 'Контент и публичные настройки', icon: <GlobalOutlined />, tone: 'slate' as const },
  { to: '/exams', title: 'Экзамены', sub: 'Каталог типов и шаблонов', icon: <AppstoreOutlined />, tone: 'blue' as const },
  { to: '/explanations', title: 'Объяснения', sub: 'Разборы по языкам и предметам', icon: <ReadOutlined />, tone: 'teal' as const },
];

type Overview = { totalUsers: number; totalTests: number; totalQuestions: number; activeSubscriptions: number };
type FunnelData = {
  totals: { visits: number; registered: number; started: number; completed: number };
  conversionRates: {
    visitToRegistered: number;
    registeredToStarted: number;
    startedToCompleted: number;
    visitToCompleted: number;
  };
  byDate: Array<{ date: string; visits: number; registered: number; started: number; completed: number }>;
};
type EntAnalytics = {
  entFound: boolean;
  completedSessions: number;
  last30Completed: number;
  avgScore: number | null;
  avgCorrectPercent: number | null;
  byLanguage: Array<{ language: string; sessions: number; avgScore: number | null; avgRawScore: number | null }>;
};
type EntPairs = {
  pairs: Array<{
    pairKey: string;
    label: string;
    sessions: number;
    avgRawScore: number | null;
    avgScore: number | null;
  }>;
};
type FinanceResponse = {
  items: Array<{
    id: string;
    planCode: string;
    amount: number;
    currency: string;
    status: 'created' | 'pending' | 'paid' | 'failed' | 'cancelled';
    createdAt: string;
    paidAt: string | null;
    user: { id: string; displayName: string; telegramUsername: string | null; phone: string | null; email: string | null };
  }>;
  summary: {
    totalOrders: number;
    paidOrders: number;
    grossRevenueKzt: number;
    averagePaidCheckKzt: number;
    paidTodayKzt: number;
    statusCounts: Record<string, number>;
  };
};
type UsersResponse = {
  items: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    telegramUsername: string | null;
    phone: string | null;
    createdAt: string;
    hasActiveSubscription: boolean;
  }>;
  total: number;
};

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(amount: number, currency = 'KZT') {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTag(status: FinanceResponse['items'][number]['status']) {
  switch (status) {
    case 'paid':
      return <Tag color="success" icon={<CheckCircleOutlined />}>paid</Tag>;
    case 'pending':
      return <Tag color="processing" icon={<ClockCircleOutlined />}>pending</Tag>;
    case 'created':
      return <Tag color="default">created</Tag>;
    case 'failed':
      return <Tag color="error">failed</Tag>;
    case 'cancelled':
      return <Tag color="warning">cancelled</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
}

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview, isFetching: fetchingOverview } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: async () => (await api.get('/admin/analytics/overview')).data as Overview,
  });

  const { data: funnel, isLoading: loadingFunnel, isFetching: fetchingFunnel } = useQuery({
    queryKey: ['admin-dashboard-funnel-30d'],
    queryFn: async () =>
      (
        await api.get('/admin/analytics/funnel', {
          params: {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10),
          },
        })
      ).data as FunnelData,
  });

  const { data: ent, isLoading: loadingEnt } = useQuery({
    queryKey: ['admin-dashboard-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data as EntAnalytics,
  });

  const { data: entPairs, isLoading: loadingPairs } = useQuery({
    queryKey: ['admin-dashboard-ent-pairs'],
    queryFn: async () => (await api.get('/admin/analytics/ent-profile-pairs')).data as EntPairs,
  });

  const { data: finance, isLoading: loadingFinance, isFetching: fetchingFinance } = useQuery({
    queryKey: ['admin-dashboard-finance'],
    queryFn: async () =>
      (
        await api.get('/admin/finance/orders', {
          params: { limit: 6, page: 1, status: 'all', provider: 'all' },
        })
      ).data as FinanceResponse,
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-dashboard-users'],
    queryFn: async () =>
      (
        await api.get('/admin/users', {
          params: { limit: 6, page: 1 },
        })
      ).data as UsersResponse,
  });

  const loading = loadingOverview || loadingFunnel || loadingEnt || loadingPairs || loadingFinance || loadingUsers;
  const isFetching = fetchingOverview || fetchingFunnel || fetchingFinance;

  const funnelSeries = useMemo(
    () =>
      (funnel?.byDate ?? []).map((row) => ({
        date: row.date.slice(5),
        visits: row.visits,
        completed: row.completed,
      })),
    [funnel?.byDate],
  );

  const topPairs = useMemo(() => (entPairs?.pairs ?? []).slice(0, 5), [entPairs?.pairs]);
  const latestPayments = finance?.items ?? [];
  const latestUsers = users?.items ?? [];

  const dashboardKpis = [
    { key: 'users', label: 'Пользователи', icon: <UserOutlined />, value: overview?.totalUsers ?? 0, tone: 'blue' as const },
    { key: 'subs', label: 'Активные подписки', icon: <CrownOutlined />, value: overview?.activeSubscriptions ?? 0, tone: 'amber' as const },
    { key: 'revenue', label: 'Выручка', icon: <CreditCardOutlined />, value: formatMoney(finance?.summary.grossRevenueKzt ?? 0), tone: 'violet' as const },
    { key: 'today', label: 'Оплат сегодня', icon: <CheckCircleOutlined />, value: formatMoney(finance?.summary.paidTodayKzt ?? 0), tone: 'teal' as const },
  ];

  const attentionItems = [
    {
      key: 'pending',
      label: 'Ожидают оплаты',
      value: finance?.summary.statusCounts.pending ?? 0,
      hint: 'Счета, которые ещё не завершились',
      tone: 'warning',
      action: () => navigate('/finance'),
    },
    {
      key: 'failed',
      label: 'Ошибки / отмены',
      value: (finance?.summary.statusCounts.failed ?? 0) + (finance?.summary.statusCounts.cancelled ?? 0),
      hint: 'Платежи, где нужен разбор причины',
      tone: 'danger',
      action: () => navigate('/finance'),
    },
    {
      key: 'ent',
      label: 'ЕНТ за 30 дней',
      value: ent?.last30Completed ?? 0,
      hint: 'Завершённых ENT-сессий за последние 30 дней',
      tone: 'info',
      action: () => navigate('/analytics/ent'),
    },
    {
      key: 'tests',
      label: 'Завершение воронки',
      value: `${Math.round(funnel?.conversionRates.visitToCompleted ?? 0)}%`,
      hint: 'Доля визитов, дошедших до завершения теста',
      tone: 'success',
      action: () => navigate('/analytics'),
    },
  ];

  if (loading && !overview) {
    return (
      <AdminPageShell wide>
        <div className="pg-dash">
          <Skeleton active paragraph={{ rows: 0 }} className="pg-dash__skeleton-hero" />
          <div className="pg-dash__kpi" style={{ marginTop: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton.Button key={i} active size="large" block style={{ height: 104, borderRadius: 16 }} />
            ))}
          </div>
          <div className="pg-dash__panel-grid" style={{ marginTop: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} active paragraph={{ rows: 6 }} className="pg-dash__skeleton-panel" />
            ))}
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell wide>
      <div className="pg-dash">
        <header className="pg-dash__hero">
          <div className="pg-dash__hero-main">
            <p className="pg-dash__eyebrow">Операционная панель</p>
            <h1 className="pg-dash__headline">Что происходит на платформе прямо сейчас</h1>
            <p className="pg-dash__lede">
              Деньги, воронка, новые пользователи и ЕНТ в одном месте. Без декоративного шума — только то, что помогает
              быстро понять, куда смотреть команде.
            </p>
          </div>
          <div className="pg-dash__hero-aside">
            <time className="pg-dash__date" dateTime={new Date().toISOString()}>
              {formatNowRu()}
            </time>
            {isFetching ? (
              <span className="pg-dash__pill pg-dash__pill--sync">
                <ThunderboltOutlined /> Обновляем срез…
              </span>
            ) : (
              <span className="pg-dash__pill">Последний снимок данных</span>
            )}
          </div>
        </header>

        <section className="pg-dash__kpi" aria-label="Ключевые метрики">
          {dashboardKpis.map((row) => (
            <article key={row.key} className={['pg-dash__kpi-card', `pg-dash__kpi-card--${row.tone}`].join(' ')}>
              <div className="pg-dash__kpi-icon" aria-hidden>
                {row.icon}
              </div>
              <div className="pg-dash__kpi-body">
                <span className="pg-dash__kpi-label">{row.label}</span>
                <span className="pg-dash__kpi-value">{row.value}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="pg-dash__attention" aria-label="Нужно внимание">
          {attentionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={['pg-dash__attention-card', `pg-dash__attention-card--${item.tone}`].join(' ')}
              onClick={item.action}
            >
              <div className="pg-dash__attention-top">
                <span className="pg-dash__attention-label">{item.label}</span>
                <ArrowRightOutlined />
              </div>
              <strong className="pg-dash__attention-value">{item.value}</strong>
              <small className="pg-dash__attention-hint">{item.hint}</small>
            </button>
          ))}
        </section>

        <section className="pg-dash__panel-grid">
          <article className="pg-dash__panel">
            <div className="pg-dash__panel-head">
              <div>
                <h2 className="pg-dash__panel-title">Платежи и выручка</h2>
                <p className="pg-dash__panel-sub">Последние заказы, статусы и свежие деньги.</p>
              </div>
              <Button type="link" onClick={() => navigate('/finance')}>
                Открыть финансы
              </Button>
            </div>

            {latestPayments.length === 0 ? (
              <Empty description="Платежей пока нет" />
            ) : (
              <div className="pg-dash__list">
                {latestPayments.map((payment) => (
                  <div key={payment.id} className="pg-dash__list-item">
                    <div className="pg-dash__list-main">
                      <div className="pg-dash__list-title-row">
                        <strong>{payment.user.displayName}</strong>
                        {statusTag(payment.status)}
                      </div>
                      <div className="pg-dash__list-sub">
                        {payment.planCode} · {formatMoney(payment.amount, payment.currency)}
                      </div>
                    </div>
                    <div className="pg-dash__list-side">
                      <span>{formatDateTime(payment.paidAt ?? payment.createdAt)}</span>
                      <Button type="link" size="small" onClick={() => navigate(`/users/${payment.user.id}`)}>
                        Профиль
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="pg-dash__panel">
            <div className="pg-dash__panel-head">
              <div>
                <h2 className="pg-dash__panel-title">Воронка за 30 дней</h2>
                <p className="pg-dash__panel-sub">Визиты и завершения тестов по дням.</p>
              </div>
              <Button type="link" onClick={() => navigate('/analytics')}>
                Вся аналитика
              </Button>
            </div>
            {funnelSeries.length === 0 ? (
              <Empty description="Нет данных по воронке" />
            ) : (
              <div className="pg-dash__chart-card">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={funnelSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="visits" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Визиты" />
                    <Line type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Завершения" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="pg-dash__chart-meta">
                  <span>Визитов: {funnel?.totals.visits ?? 0}</span>
                  <span>Регистраций: {funnel?.totals.registered ?? 0}</span>
                  <span>Стартов: {funnel?.totals.started ?? 0}</span>
                  <span>Завершений: {funnel?.totals.completed ?? 0}</span>
                </div>
              </div>
            )}
          </article>

          <article className="pg-dash__panel">
            <div className="pg-dash__panel-head">
              <div>
                <h2 className="pg-dash__panel-title">ЕНТ: что выбирают</h2>
                <p className="pg-dash__panel-sub">Топ профильных пар и средний результат.</p>
              </div>
              <Button type="link" onClick={() => navigate('/analytics/ent')}>
                Открыть ЕНТ
              </Button>
            </div>
            {!ent?.entFound ? (
              <Empty description="ENT ещё не настроен в каталоге" />
            ) : topPairs.length === 0 ? (
              <Empty description="Нет завершённых сессий по парам" />
            ) : (
              <div className="pg-dash__pair-list">
                {topPairs.map((pair) => (
                  <div key={pair.pairKey} className="pg-dash__pair-item">
                    <div className="pg-dash__pair-main">
                      <strong>{pair.label}</strong>
                      <small>{pair.sessions} сессий</small>
                    </div>
                    <div className="pg-dash__pair-metrics">
                      <span>{pair.avgRawScore != null ? `${pair.avgRawScore.toFixed(1)} балла` : '—'}</span>
                      <Tag color="blue">{pair.avgScore != null ? `${pair.avgScore.toFixed(1)}%` : '—'}</Tag>
                    </div>
                  </div>
                ))}
                <div className="pg-dash__chart-meta">
                  {(ent.byLanguage ?? []).map((lang) => (
                    <span key={lang.language}>
                      {lang.language.toUpperCase()}: {lang.sessions}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>

          <article className="pg-dash__panel">
            <div className="pg-dash__panel-head">
              <div>
                <h2 className="pg-dash__panel-title">Новые пользователи</h2>
                <p className="pg-dash__panel-sub">Последние регистрации и быстрый переход в профиль.</p>
              </div>
              <Button type="link" onClick={() => navigate('/users')}>
                Весь список
              </Button>
            </div>
            {latestUsers.length === 0 ? (
              <Empty description="Пользователей пока нет" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={latestUsers}
                columns={[
                  {
                    title: 'Пользователь',
                    render: (_value, user: UsersResponse['items'][number]) => (
                      <div className="pg-dash__user-cell">
                        <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.telegramUsername || user.phone || '—'}</strong>
                        <small>{user.telegramUsername ? `@${user.telegramUsername}` : user.phone ? `+${user.phone}` : 'Без контакта'}</small>
                      </div>
                    ),
                  },
                  {
                    title: 'Premium',
                    dataIndex: 'hasActiveSubscription',
                    width: 100,
                    render: (value: boolean) => (value ? <Tag color="gold">Да</Tag> : <Tag>Нет</Tag>),
                  },
                  {
                    title: 'Регистрация',
                    dataIndex: 'createdAt',
                    width: 130,
                    render: (value: string) => formatDateTime(value),
                  },
                  {
                    title: '',
                    key: 'actions',
                    width: 90,
                    render: (_value, user: UsersResponse['items'][number]) => (
                      <Button type="link" size="small" onClick={() => navigate(`/users/${user.id}`)}>
                        Открыть
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </article>
        </section>

        <div className="pg-dash__split">
          <aside className="pg-dash__nav-panel" aria-label="Отчёты">
            <h3 className="pg-dash__nav-title">Отчёты</h3>
            <p className="pg-dash__nav-sub">Разобраться, где рост, где просадка и что делать дальше.</p>
            {reportsNav.map((item) => (
              <button key={item.to} type="button" className="pg-dash__link-row" onClick={() => navigate(item.to)}>
                <div className="pg-dash__link-ico">{item.icon}</div>
                <div className="pg-dash__link-text">
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </div>
                <RightOutlined className="pg-dash__link-arrow" />
              </button>
            ))}
          </aside>

          <section className="pg-dash__ops" aria-label="Операции">
            <div className="pg-dash__ops-header">
              <h3 className="pg-dash__ops-title">Операции</h3>
              <p className="pg-dash__ops-sub">Повседневная работа команды по продукту, контенту и доступам.</p>
            </div>
            <div className="pg-dash__ops-grid">
              {opsNav.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className={['pg-dash__op', `pg-dash__op--${item.tone}`].join(' ')}
                  onClick={() => navigate(item.to)}
                >
                  <span className="pg-dash__op-ico">{item.icon}</span>
                  <span className="pg-dash__op-title">{item.title}</span>
                  <span className="pg-dash__op-sub">{item.sub}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminPageShell>
  );
}
