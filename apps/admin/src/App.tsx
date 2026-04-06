import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ConfigProvider,
  Layout,
  Menu,
  theme,
  Spin,
  Avatar,
  Button,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  QuestionCircleOutlined,
  CrownOutlined,
  BarChartOutlined,
  DashboardOutlined,
  LineChartOutlined,
  BookOutlined,
  RocketOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { api, clearTokens } from './api/client';
import { UsersPage } from './pages/UsersPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntTrialsAnalyticsPage } from './pages/EntTrialsAnalyticsPage';
import { UniversityThresholdsPage } from './pages/UniversityThresholdsPage';
import { AdmissionChancePage } from './pages/AdmissionChancePage';
import { ExplanationsPage } from './pages/ExplanationsPage';
import { LoginPage } from './pages/LoginPage';

const { Sider, Content, Header } = Layout;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const MENU_NAV: Record<string, string> = {
  dashboard: '/dashboard',
  'analytics-platform': '/analytics',
  'analytics-ent': '/analytics/ent',
  'analytics-thresholds': '/analytics/thresholds',
  admission: '/admission',
  explanations: '/explanations',
  users: '/users',
  questions: '/questions',
  subscriptions: '/subscriptions',
};

function menuKeyFromPath(pathname: string): string {
  if (pathname.startsWith('/analytics/ent')) return 'analytics-ent';
  if (pathname.startsWith('/analytics/thresholds')) return 'analytics-thresholds';
  if (pathname.startsWith('/analytics')) return 'analytics-platform';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/admission')) return 'admission';
  if (pathname.startsWith('/explanations')) return 'explanations';
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/questions')) return 'questions';
  if (pathname.startsWith('/subscriptions')) return 'subscriptions';
  return 'dashboard';
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const selectedKey = useMemo(() => menuKeyFromPath(location.pathname), [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/analytics')) {
      setOpenKeys((k) => (k.includes('analytics') ? k : [...k, 'analytics']));
    }
  }, [location.pathname]);

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      {
        key: 'analytics',
        icon: <BarChartOutlined />,
        label: 'Аналитика',
        children: [
          { key: 'analytics-platform', icon: <FundProjectionScreenOutlined />, label: 'Платформа' },
          { key: 'analytics-ent', icon: <LineChartOutlined />, label: 'Пробные ЕНТ' },
          { key: 'analytics-thresholds', icon: <BookOutlined />, label: 'Пороги в вузы (5 лет)' },
        ],
      },
      { key: 'admission', icon: <RocketOutlined />, label: 'Шанс поступления' },
      { key: 'explanations', icon: <QuestionCircleOutlined />, label: 'Объяснения вопросов' },
      { type: 'divider' },
      { key: 'users', icon: <UserOutlined />, label: 'Пользователи' },
      { key: 'questions', icon: <QuestionCircleOutlined />, label: 'Вопросы' },
      { key: 'subscriptions', icon: <CrownOutlined />, label: 'Подписки' },
    ],
    [],
  );

  useEffect(() => {
    setLoadingUser(true);
    api
      .get('/users/me')
      .then(({ data }) => {
        if (!data.isAdmin) {
          clearTokens();
          navigate('/login', { replace: true });
          return;
        }
        setUser(data);
      })
      .catch(() => {
        clearTokens();
        navigate('/login', { replace: true });
      })
      .finally(() => setLoadingUser(false));
  }, [navigate]);

  if (loadingUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <Layout className="admin-shell">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        style={{
          background: 'linear-gradient(180deg, #0c1324 0%, #111827 100%)',
          boxShadow: '4px 0 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div className="admin-sider-brand">
          <div className="admin-sider-brand-title">{collapsed ? 'MT' : 'MyTest Admin'}</div>
          {!collapsed && <div className="admin-sider-brand-sub">Анализ · контент · доступ</div>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          onClick={({ key }) => {
            const path = MENU_NAV[key];
            if (path) navigate(path);
          }}
          style={{ background: 'transparent', border: 'none' }}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 15, color: '#0f172a' }}>
            Панель администратора
          </Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size="small" style={{ backgroundColor: '#3b5bdb' }}>
              {(user.firstName || user.telegramUsername || 'A').slice(0, 1).toUpperCase()}
            </Avatar>
            <span>
              {user.firstName} {user.lastName}
            </span>
            <Button
              type="link"
              onClick={() => {
                clearTokens();
                navigate('/login', { replace: true });
              }}
            >
              Выйти
            </Button>
          </div>
        </Header>
        <Content className="admin-content-wrap">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/analytics/ent" element={<EntTrialsAnalyticsPage />} />
            <Route path="/analytics/thresholds" element={<UniversityThresholdsPage />} />
            <Route path="/admission" element={<AdmissionChancePage />} />
            <Route path="/explanations" element={<ExplanationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: '#3b5bdb',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
