import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';

const reportsNav = [
  {
    to: '/analytics',
    icon: <BarChartOutlined />,
    title: 'Воронка платформы',
    sub: 'Визиты, регистрации, тесты по дням',
  },
  {
    to: '/admission',
    icon: <RocketOutlined />,
    title: 'Калькулятор шанса',
    sub: 'Баллы ЕНТ и проходной по вузу',
  },
  {
    to: '/analytics/thresholds',
    icon: <BookOutlined />,
    title: 'Пороги вузов',
    sub: 'Грант и сельская квота',
  },
  {
    to: '/explanations',
    icon: <ReadOutlined />,
    title: 'Объяснения к вопросам',
    sub: 'По языкам и предметам',
  },
];

const opsNav = [
  { to: '/users', title: 'Пользователи', sub: 'Поиск, admin, v2-доступ', icon: <TeamOutlined />, tone: 'blue' as const },
  { to: '/questions', title: 'Вопросы', sub: 'Банк заданий', icon: <FormOutlined />, tone: 'violet' as const },
  { to: '/subscriptions', title: 'Подписки', sub: 'Шаблоны и выдача', icon: <CrownOutlined />, tone: 'amber' as const },
  { to: '/landing-settings', title: 'Лендинг', sub: 'Видео, соцсети, слайды', icon: <GlobalOutlined />, tone: 'teal' as const },
  { to: '/exams', title: 'Экзамены', sub: 'Каталог типов', icon: <AppstoreOutlined />, tone: 'slate' as const },
];

const kpi = [
  { key: 'users', label: 'Пользователи', icon: <UserOutlined />, field: 'totalUsers' as const, tone: 'blue' as const },
  { key: 'tests', label: 'Тесты', icon: <FileTextOutlined />, field: 'totalTests' as const, tone: 'violet' as const },
  { key: 'questions', label: 'Вопросы', icon: <QuestionCircleOutlined />, field: 'totalQuestions' as const, tone: 'teal' as const },
  { key: 'subs', label: 'Подписки', icon: <CrownOutlined />, field: 'activeSubscriptions' as const, tone: 'amber' as const },
];

type Overview = { totalUsers: number; totalTests: number; totalQuestions: number; activeSubscriptions: number };

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview, isFetching } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics/overview')).data as Overview,
  });

  const { data: ent, isLoading: loadingEnt } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
  });

  const loading = loadingOverview || loadingEnt;

  if (loading && !overview) {
    return (
      <AdminPageShell>
        <div className="pg-dash">
          <Skeleton active paragraph={{ rows: 0 }} className="pg-dash__skeleton-hero" />
          <div className="pg-dash__bento" style={{ marginTop: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton.Button key={i} active size="large" block style={{ height: 120, borderRadius: 16 }} />
            ))}
          </div>
          <div className="pg-dash__split" style={{ marginTop: 8 }}>
            <Skeleton active paragraph={{ rows: 4 }} className="pg-dash__skeleton-panel" />
            <Skeleton active paragraph={{ rows: 4 }} className="pg-dash__skeleton-panel" />
          </div>
        </div>
      </AdminPageShell>
    );
  }

  const entShare30 =
    ent?.entFound && (ent.completedSessions ?? 0) > 0
      ? Math.min(100, Math.round((ent.last30Completed / ent.completedSessions) * 100))
      : 0;

  return (
    <AdminPageShell>
      <div className="pg-dash">
        <header className="pg-dash__hero">
          <div className="pg-dash__hero-main">
            <p className="pg-dash__eyebrow">Панель администратора</p>
            <h1 className="pg-dash__headline">Сводка платформы</h1>
            <p className="pg-dash__lede">
              Каталог, аудитория и пробные ЕНТ в одном экране. Ниже — отчёты, операции и быстрые действия.
            </p>
          </div>
          <div className="pg-dash__hero-aside">
            <time className="pg-dash__date" dateTime={new Date().toISOString()}>
              {formatNowRu()}
            </time>
            {isFetching ? (
              <span className="pg-dash__pill pg-dash__pill--sync">
                <ThunderboltOutlined /> Обновление…
              </span>
            ) : (
              <span className="pg-dash__pill">Данные на момент загрузки</span>
            )}
          </div>
        </header>

        <section className="pg-dash__kpi" aria-label="Ключевые метрики">
          {kpi.map((row) => (
            <article
              key={row.key}
              className={['pg-dash__kpi-card', `pg-dash__kpi-card--${row.tone}`].join(' ')}
            >
              <div className="pg-dash__kpi-icon" aria-hidden>
                {row.icon}
              </div>
              <div className="pg-dash__kpi-body">
                <span className="pg-dash__kpi-label">{row.label}</span>
                <span className="pg-dash__kpi-value">{overview?.[row.field] ?? 0}</span>
              </div>
            </article>
          ))}
        </section>

        <div className="pg-dash__split">
          <section className="pg-dash__ent" aria-labelledby="dash-ent-title">
            <div className="pg-dash__ent-top">
              <div className="pg-dash__ent-badge">
                <LineChartOutlined /> ЕНТ
              </div>
              <h2 id="dash-ent-title" className="pg-dash__ent-title">
                Пробные тесты
              </h2>
            </div>
            <p className="pg-dash__ent-hint">
              Статистика по типу экзамена <code>ent</code> в каталоге: завершённые сессии и качество попыток.
            </p>

            {!ent?.entFound ? (
              <div className="pg-dash__ent-missing" role="status">
                <p className="pg-dash__empty">В каталоге нет экзамена с slug <code>ent</code>. Добавьте его в разделе «Экзамены».</p>
                <Button type="default" onClick={() => navigate('/exams')}>
                  Открыть каталог
                </Button>
              </div>
            ) : (
              <>
                <div className="pg-dash__ent-grid">
                  <div className="pg-dash__ent-cell">
                    <span className="pg-dash__ent-k">Всего завершено</span>
                    <span className="pg-dash__ent-v">{ent.completedSessions}</span>
                  </div>
                  <div className="pg-dash__ent-cell">
                    <span className="pg-dash__ent-k">За 30 дней</span>
                    <span className="pg-dash__ent-v">{ent.last30Completed}</span>
                  </div>
                  <div className="pg-dash__ent-cell">
                    <span className="pg-dash__ent-k">Ср. балл</span>
                    <span className="pg-dash__ent-v">{ent.avgScore != null ? Number(ent.avgScore).toFixed(1) : '—'}</span>
                  </div>
                  <div className="pg-dash__ent-cell">
                    <span className="pg-dash__ent-k">Ср. % верных</span>
                    <span className="pg-dash__ent-v">
                      {ent.avgCorrectPercent != null ? `${ent.avgCorrectPercent.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>
                {ent.completedSessions > 0 && (
                  <div className="pg-dash__ent-momentum">
                    <div className="pg-dash__ent-momentum-head">
                      <span>Доля завершений за 30 дней</span>
                      <strong>{entShare30}%</strong>
                    </div>
                    <div className="pg-dash__ent-bar" role="progressbar" aria-valuenow={entShare30} aria-valuemin={0} aria-valuemax={100}>
                      <div className="pg-dash__ent-bar-fill" style={{ width: `${entShare30}%` }} />
                    </div>
                  </div>
                )}
                <div className="pg-dash__ent-actions">
                  <Button type="primary" size="large" icon={<LineChartOutlined />} onClick={() => navigate('/analytics/ent')}>
                    Аналитика ЕНТ
                  </Button>
                  <Button size="large" onClick={() => navigate('/exams')}>
                    Каталог экзаменов
                  </Button>
                </div>
              </>
            )}
          </section>

          <aside className="pg-dash__nav-panel" aria-label="Отчёты">
            <h3 className="pg-dash__nav-title">Отчёты и инструменты</h3>
            <p className="pg-dash__nav-sub">Аналитика приёма и контента</p>
            {reportsNav.map((item) => (
              <button
                key={item.to}
                type="button"
                className="pg-dash__link-row"
                onClick={() => navigate(item.to)}
              >
                <div className="pg-dash__link-ico">{item.icon}</div>
                <div className="pg-dash__link-text">
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </div>
                <RightOutlined className="pg-dash__link-arrow" />
              </button>
            ))}
          </aside>
        </div>

        <section className="pg-dash__ops" aria-label="Операции">
          <div className="pg-dash__ops-header">
            <h3 className="pg-dash__ops-title">Операции</h3>
            <p className="pg-dash__ops-sub">Ежедневные задачи по контенту и доступам</p>
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
    </AdminPageShell>
  );
}
