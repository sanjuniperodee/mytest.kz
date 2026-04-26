import { useQuery } from '@tanstack/react-query';
import { Button, Spin } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';

const nav = [
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

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get('/admin/analytics/overview')).data,
  });

  const { data: ent, isLoading: loadingEnt } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
  });

  if (loadingOverview || loadingEnt) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <div className="pg-dash">
        <p className="pg-dash__intro">
          Сводка по каталогу и пользователям. Пробные ЕНТ — отдельный блок; ниже — быстрые переходы в отчёты и
          инструменты.
        </p>

        <div className="pg-dash__bento">
          <article className="pg-dash__tile">
            <div className="pg-dash__tile-ico">
              <UserOutlined />
            </div>
            <div>
              <span className="pg-dash__tile-label">Пользователи</span>
              <div className="pg-dash__tile-value">{overview?.totalUsers ?? 0}</div>
            </div>
          </article>
          <article className="pg-dash__tile">
            <div className="pg-dash__tile-ico">
              <FileTextOutlined />
            </div>
            <div>
              <span className="pg-dash__tile-label">Тесты</span>
              <div className="pg-dash__tile-value">{overview?.totalTests ?? 0}</div>
            </div>
          </article>
          <article className="pg-dash__tile">
            <div className="pg-dash__tile-ico">
              <QuestionCircleOutlined />
            </div>
            <div>
              <span className="pg-dash__tile-label">Вопросы</span>
              <div className="pg-dash__tile-value">{overview?.totalQuestions ?? 0}</div>
            </div>
          </article>
          <article className="pg-dash__tile">
            <div className="pg-dash__tile-ico pg-dash__tile-ico--warm">
              <CrownOutlined />
            </div>
            <div>
              <span className="pg-dash__tile-label">Подписки</span>
              <div className="pg-dash__tile-value pg-dash__tile-value--accent">{overview?.activeSubscriptions ?? 0}</div>
            </div>
          </article>
        </div>

        <div className="pg-dash__split">
          <section className="pg-dash__ent">
            <h2 className="pg-dash__ent-title">Пробные ЕНТ</h2>
            <p className="pg-dash__ent-hint">Тип экзамена <code>ent</code> в каталоге — завершённые сессии и средние показатели.</p>
            {!ent?.entFound ? (
              <p className="pg-dash__empty">В каталоге нет типа <code>ent</code>. Добавьте экзамен с таким slug.</p>
            ) : (
              <div className="pg-dash__ent-grid">
                <div className="pg-dash__ent-stat">
                  <span>Завершено</span>
                  <span>{ent.completedSessions}</span>
                </div>
                <div className="pg-dash__ent-stat">
                  <span>За 30 дней</span>
                  <span>{ent.last30Completed}</span>
                </div>
                <div className="pg-dash__ent-stat">
                  <span>Ср. балл</span>
                  <span>{ent.avgScore != null ? Number(ent.avgScore).toFixed(1) : '—'}</span>
                </div>
                <div className="pg-dash__ent-stat">
                  <span>Ср. % верных</span>
                  <span>{ent.avgCorrectPercent != null ? `${ent.avgCorrectPercent.toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            )}
            <Button type="primary" icon={<LineChartOutlined />} onClick={() => navigate('/analytics/ent')}>
              Подробная аналитика ЕНТ
            </Button>
          </section>

          <aside className="pg-dash__links">
            <h3 className="pg-dash__links-title">Куда дальше</h3>
            {nav.map((item) => (
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
      </div>
    </AdminPageShell>
  );
}
