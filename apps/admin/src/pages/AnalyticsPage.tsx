import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, DatePicker, Statistic, Table, Tabs, Tag } from 'antd';
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
import { HigTableCard } from '../components/HigBlocks';

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
            <span className="hig-cell-muted"> @{v.user.telegramUsername || '—'}</span>
          </span>
        ) : (
          <span className="hig-cell-muted">Не зарегистрирован</span>
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
            <span className="hig-cell-muted"> @{u.telegramUsername}</span>
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
      <div className="pg-a">
        <p className="pg-a__intro">
          Сводка по каталогу, затем <strong>период</strong> для воронки и таблиц. Вкладки «Сводка» и «Воронка» смотрят
          на выбранные даты; «Посетители» / «Тесты» — тоже.
        </p>

        <div className="pg-a__section">
          <h3 className="pg-a__section-title">Состояние каталога</h3>
          <p className="pg-a__section-desc">Без привязки к датам: пользователи, тесты, вопросы, активные подписки.</p>
          <div className="pg-a__bento">
            <div className="pg-a__tile">
              <Card loading={overviewLoading} bordered={false} style={{ background: 'transparent' }}>
                <Statistic title="Пользователи" value={overview?.totalUsers ?? 0} prefix={<UserOutlined />} />
              </Card>
            </div>
            <div className="pg-a__tile">
              <Card loading={overviewLoading} bordered={false} style={{ background: 'transparent' }}>
                <Statistic title="Тесты" value={overview?.totalTests ?? 0} prefix={<FileTextOutlined />} />
              </Card>
            </div>
            <div className="pg-a__tile">
              <Card loading={overviewLoading} bordered={false} style={{ background: 'transparent' }}>
                <Statistic title="Вопросы" value={overview?.totalQuestions ?? 0} prefix={<QuestionCircleOutlined />} />
              </Card>
            </div>
            <div className="pg-a__tile">
              <Card loading={overviewLoading} bordered={false} style={{ background: 'transparent' }}>
                <Statistic
                  title="Подписки"
                  value={overview?.activeSubscriptions ?? 0}
                  prefix={<CrownOutlined />}
                  valueStyle={{ color: '#ff9f0a' }}
                />
              </Card>
            </div>
          </div>
        </div>

        <div className="pg-a__section">
          <h3 className="pg-a__section-title">Период отчёта</h3>
          <p className="pg-a__section-desc">Воронка и таблицы ниже пересчитываются от начальной до конечной даты включительно.</p>
          <div className="pg-a__cockpit">
            <div className="pg-a__cockpit-row">
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
              <Button onClick={resetDateFilters}>Сбросить 30 дн.</Button>
            </div>
            <div className="pg-a__range-badge">
              Активный диапазон: {from} — {to}
            </div>
          </div>
        </div>

        <h3 className="pg-a__section-title" style={{ marginTop: 8 }}>
          Разбивка
        </h3>
        <Tabs
        className="hig-page-tabs"
        size="middle"
        items={[
          {
            key: 'summary',
            label: 'Сводка',
            children: (
              <div>
                {funnelLoading && !funnel ? (
                  <Card loading style={{ minHeight: 120 }} />
                ) : funnel ? (
                  <div className="pg-a__bento">
                    {[
                      { label: 'Визитов (уник.)', value: funnel.totals.visits },
                      { label: 'Зарегистрировано', value: funnel.totals.registered },
                      { label: 'Начали тест', value: funnel.totals.started },
                      { label: 'Завершили тест', value: funnel.totals.completed },
                    ].map((x) => (
                      <div className="pg-a__tile" key={x.label}>
                        <Card bordered={false} size="small" style={{ background: 'transparent' }}>
                          <Statistic title={x.label} value={x.value} />
                        </Card>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
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
                  <div className="hig-inner-flow">
                    <div className="pg-a__funnel-layout">
                      <Card title="Шаги (объёмы)" className="hig-chart-card">
                        <PlatformFunnelBarChart data={funnel} />
                      </Card>
                      <div>
                        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>
                          Конверсии, %
                        </h4>
                        <div className="pg-a__conv-list">
                          {[
                            { label: 'Визит → регистрация', v: cr?.visitToRegistered ?? 0 },
                            { label: 'Регистрация → старт', v: cr?.registeredToStarted ?? 0 },
                            { label: 'Старт → завершение', v: cr?.startedToCompleted ?? 0 },
                            { label: 'Визит → завершение', v: cr?.visitToCompleted ?? 0 },
                          ].map((x) => (
                            <div className="pg-a__conv-item" key={x.label}>
                              <span className="pg-a__conv-label">{x.label}</span>
                              <span className="pg-a__conv-val">{Number(x.v).toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {funnel.byDate.length > 0 && (
                      <Card title="Визиты и завершения по дням" className="hig-chart-card">
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
                                stroke="#007aff"
                                dot={false}
                                name="Визиты"
                              />
                              <Line
                                type="monotone"
                                dataKey="completed"
                                stroke="#5ac8fa"
                                dot={false}
                                name="Завершения"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    )}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: 'visitors',
            label: 'Посетители',
            children: (
              <HigTableCard>
                <Table<Visitor>
                  size="small"
                  rowKey="visitorId"
                  loading={visitorsLoading}
                  dataSource={visitors?.items}
                  columns={visitorColumns}
                  pagination={visitorPagination}
                  scroll={{ x: 900 }}
                />
              </HigTableCard>
            ),
          },
          {
            key: 'takers',
            label: 'Тесты',
            children: (
              <HigTableCard>
                <Table<TestTaker>
                  size="small"
                  rowKey="userId"
                  loading={takersLoading}
                  dataSource={takers?.items}
                  columns={takerColumns}
                  pagination={takerPagination}
                  scroll={{ x: 1000 }}
                />
              </HigTableCard>
            ),
          },
        ]}
        />
      </div>
    </AdminPageShell>
  );
}
