import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import {
  FileTextOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  fetchFunnel,
  fetchPlatformOverview,
  fetchTestTakers,
  fetchVisitors,
  type TestTaker,
  type Visitor,
} from '../api/platformAnalytics';
import { PlatformFunnelBarChart } from '../components/PlatformFunnelBarChart';
import { AdminPageShell } from '../components/AdminPageShell';

const df = 'YYYY-MM-DD';
const PAGE_SIZE = 50;

function toDateStr(d: dayjs.Dayjs) {
  return d.format(df);
}

function defaultFromTo() {
  return { from: toDateStr(dayjs().subtract(30, 'day')), to: toDateStr(dayjs()) };
}

export function AnalyticsPage() {
  const [{ from, to }, setRange] = useState(defaultFromTo);
  const [draftFrom, setDraftFrom] = useState(() => dayjs().subtract(30, 'day'));
  const [draftTo, setDraftTo] = useState(() => dayjs());
  const [visitorPage, setVisitorPage] = useState(1);
  const [takerPage, setTakerPage] = useState(1);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: fetchPlatformOverview,
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['admin-analytics-funnel', { from, to }],
    queryFn: () => fetchFunnel({ from, to }),
  });

  const { data: visitors, isLoading: visitorsLoading } = useQuery({
    queryKey: ['admin-analytics-visitors', { from, to, page: visitorPage }],
    queryFn: () => fetchVisitors({ from, to, page: visitorPage, limit: PAGE_SIZE }),
  });

  const { data: takers, isLoading: takersLoading } = useQuery({
    queryKey: ['admin-analytics-takers', { from, to, page: takerPage }],
    queryFn: () => fetchTestTakers({ from, to, page: takerPage, limit: PAGE_SIZE }),
  });

  const applyDateFilters = () => {
    setRange({ from: toDateStr(draftFrom), to: toDateStr(draftTo) });
    setVisitorPage(1);
    setTakerPage(1);
  };

  const resetDateFilters = () => {
    const d0 = dayjs().subtract(30, 'day');
    const d1 = dayjs();
    setDraftFrom(d0);
    setDraftTo(d1);
    setRange({ from: toDateStr(d0), to: toDateStr(d1) });
    setVisitorPage(1);
    setTakerPage(1);
  };

  const cr = funnel?.conversionRates;
  const visitorPagination: TablePaginationConfig = {
    current: visitorPage,
    pageSize: PAGE_SIZE,
    total: visitors?.total,
    onChange: (p) => setVisitorPage(p),
    showSizeChanger: false,
  };

  const takerPagination: TablePaginationConfig = {
    current: takerPage,
    pageSize: PAGE_SIZE,
    total: takers?.total,
    onChange: (p) => setTakerPage(p),
    showSizeChanger: false,
  };

  const visitorColumns = [
    {
      title: 'ID посетителя',
      dataIndex: 'visitorId',
      key: 'vid',
      width: 120,
      render: (id: string) => (
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{id.slice(0, 8)}…</span>
      ),
    },
    {
      title: 'Пользователь',
      key: 'user',
      render: (_: unknown, v: Visitor) =>
        v.user ? (
          <span>
            {v.user.firstName} {v.user.lastName}
            <span style={{ color: '#94a3b8' }}> @{v.user.telegramUsername || '—'}</span>
          </span>
        ) : (
          <span style={{ color: '#94a3b8' }}>Не зарегистрирован</span>
        ),
    },
    {
      title: 'Первый визит',
      dataIndex: 'firstSeen',
      key: 'first',
      width: 130,
      render: (d: string) => new Date(d).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Шаги',
      dataIndex: 'steps',
      key: 'steps',
      render: (steps: string[]) => (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {steps.map((s) => (
            <Tag key={s} color="purple" style={{ margin: 0 }}>
              {s}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: 'Тесты завершены',
      key: 'done',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, v: Visitor) => v.completedSessions.length,
    },
  ];

  const takerColumns = [
    {
      title: 'Telegram',
      dataIndex: 'telegramId',
      key: 'tg',
      width: 120,
      render: (id: number) => (
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{id}</span>
      ),
    },
    {
      title: 'Имя',
      key: 'name',
      render: (_: unknown, u: TestTaker) => (
        <span>
          {u.firstName} {u.lastName}
          {u.telegramUsername && (
            <span style={{ color: '#94a3b8' }}> @{u.telegramUsername}</span>
          )}
        </span>
      ),
    },
    {
      title: 'Тестов',
      dataIndex: 'testsCompleted',
      key: 'tc',
      width: 90,
      align: 'right' as const,
    },
    {
      title: 'Последний тест',
      dataIndex: 'lastTestAt',
      key: 'last',
      width: 120,
      align: 'right' as const,
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—'),
    },
    {
      title: 'Лучший %',
      dataIndex: 'bestScore',
      key: 'best',
      width: 90,
      align: 'right' as const,
      render: (s: number | null) => (s != null ? `${s}` : '—'),
    },
    {
      title: 'Средний %',
      dataIndex: 'avgScore',
      key: 'avg',
      width: 90,
      align: 'right' as const,
      render: (s: number | null) => (s != null ? `${s}` : '—'),
    },
    {
      title: 'Ср. длит.',
      dataIndex: 'avgDurationSecs',
      key: 'dur',
      width: 100,
      align: 'right' as const,
      render: (sec: number | null) =>
        sec != null ? `${Math.round(sec / 60)} мин` : '—',
    },
  ];

  return (
    <AdminPageShell>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small" loading={overviewLoading}>
            <Statistic title="Пользователи" value={overview?.totalUsers ?? 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small" loading={overviewLoading}>
            <Statistic title="Тесты" value={overview?.totalTests ?? 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small" loading={overviewLoading}>
            <Statistic title="Вопросы" value={overview?.totalQuestions ?? 0} prefix={<QuestionCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="admin-stat-card" size="small" loading={overviewLoading}>
            <Statistic
              title="Подписки"
              value={overview?.activeSubscriptions ?? 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#ca8a04' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }} title="Период (воронка и таблицы)">
        <Space wrap align="center">
          <DatePicker
            value={draftFrom}
            onChange={(d) => d && setDraftFrom(d)}
            format={df}
            allowClear={false}
          />
          <span>—</span>
          <DatePicker
            value={draftTo}
            onChange={(d) => d && setDraftTo(d)}
            format={df}
            allowClear={false}
          />
          <Button type="primary" onClick={applyDateFilters}>
            Применить
          </Button>
          <Button onClick={resetDateFilters}>30 дней</Button>
        </Space>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--admin-muted)' }}>{from} — {to}</div>
      </Card>

      <Tabs
        size="middle"
        items={[
          {
            key: 'summary',
            label: 'Сводка',
            children: (
              <Row gutter={[16, 16]}>
                {funnelLoading && !funnel ? (
                  <Col span={24}>
                    <Card loading />
                  </Col>
                ) : funnel ? (
                  [
                    { label: 'Визитов (уник.)', value: funnel.totals.visits },
                    { label: 'Зарегистрировано', value: funnel.totals.registered },
                    { label: 'Начали тест', value: funnel.totals.started },
                    { label: 'Завершили тест', value: funnel.totals.completed },
                  ].map((x) => (
                    <Col xs={12} md={6} key={x.label}>
                      <Card>
                        <Statistic title={x.label} value={x.value} />
                      </Card>
                    </Col>
                  ))
                ) : null}
              </Row>
            ),
          },
          {
            key: 'funnel',
            label: 'Воронка',
            children: (
              <div>
                {funnelLoading && !funnel ? (
                  <Card loading style={{ minHeight: 200 }} />
                ) : funnel ? (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                      {[
                        { label: 'Визит → регистрация', v: cr?.visitToRegistered ?? 0 },
                        { label: 'Регистрация → старт', v: cr?.registeredToStarted ?? 0 },
                        { label: 'Старт → завершение', v: cr?.startedToCompleted ?? 0 },
                        { label: 'Визит → завершение', v: cr?.visitToCompleted ?? 0 },
                      ].map((x) => (
                        <Col xs={12} md={6} key={x.label}>
                          <Card>
                            <Statistic
                              title={x.label}
                              value={x.v}
                              suffix="%"
                              valueStyle={{ color: '#7c3aed' }}
                            />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                    <Card title="Шаги воронки (объёмы)">
                      <PlatformFunnelBarChart data={funnel} />
                    </Card>
                    {funnel.byDate.length > 0 && (
                      <Card title="Динамика по дням">
                        <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer>
                            <LineChart data={funnel.byDate}>
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v: string) => String(v).slice(5)}
                              />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="visits"
                                stroke="#7c3aed"
                                dot={false}
                                name="Визиты"
                              />
                              <Line
                                type="monotone"
                                dataKey="completed"
                                stroke="#a78bfa"
                                dot={false}
                                name="Завершения"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    )}
                  </Space>
                ) : null}
              </div>
            ),
          },
          {
            key: 'visitors',
            label: 'Посетители',
            children: (
              <Table<Visitor>
                size="small"
                rowKey="visitorId"
                loading={visitorsLoading}
                dataSource={visitors?.items}
                columns={visitorColumns}
                pagination={visitorPagination}
                scroll={{ x: 900 }}
              />
            ),
          },
          {
            key: 'takers',
            label: 'Тесты',
            children: (
              <Table<TestTaker>
                size="small"
                rowKey="userId"
                loading={takersLoading}
                dataSource={takers?.items}
                columns={takerColumns}
                pagination={takerPagination}
                scroll={{ x: 1000 }}
              />
            ),
          },
        ]}
      />
    </AdminPageShell>
  );
}
